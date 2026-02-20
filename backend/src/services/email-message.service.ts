import type { Loaded, OrderDefinition, Populate } from '@mikro-orm/postgresql';
import { RequestContext } from '@mikro-orm/postgresql';
import * as cheerio from 'cheerio';
import type { gmail_v1 } from 'googleapis/build/src/apis/gmail/v1';
import type { BoardCard } from '@/entities/board-card';
import { BoardColumn } from '@/entities/board-column';
import { Domain } from '@/entities/domain';
import { EmailMessage, type Participant } from '@/entities/email-message';
import { GmailAccount } from '@/entities/gmail-account';
import { GmailAttachment } from '@/entities/gmail-attachment';
import { AgentService } from '@/services/agent.service';
import { BoardCardService } from '@/services/board-card.service';
import { DomainService } from '@/services/domain.service';
import { GmailAccountService } from '@/services/gmail-account.service';
import { ENV } from '@/utils/env';
import { reportError } from '@/utils/error-tracking';
import { GmailApi, LABEL } from '@/utils/gmail-api';
import { groupBy, mapBy, presence, unique } from '@/utils/lists';
import { orm } from '@/utils/orm';
import { FALLBACK_SUBJECT, GmailAccountState } from '@/utils/shared';
import { renderTemplate } from '@/utils/strings';
import { sleep } from '@/utils/time';
import { BoardAccountService } from './board-account.service';

const CREATE_NEW_EMAIL_MESSAGES_READ_DB_INTERVAL_MS = 60 * 1_000; // 60 seconds
const CREATE_NEW_EMAIL_MESSAGES_GMAIL_API_INTERVAL_MS = 5 * 1_000; // 5 seconds
const CREATE_EMAIL_MESSAGES_BATCH_LIMIT = ENV.NODE_ENV === 'production' ? 30 : 10;
const MAX_INITIAL_BOARD_COUNT = 5;
const CIRCUIT_BREAKER_FAILURE_THRESHOLD = 3;
const CIRCUIT_BREAKER_IGNORE_DURATION_MS = 20 * 60 * 1_000; // 20 minutes

const CATEGORIES = {
  ENGINEERING: 'Engineering',
  FINANCE: 'Finance',
  MEETINGS: 'Meetings',
  PROMOTIONS: 'Promotions',
  EDUCATION: 'Education',
  CUSTOMER_INQUIRIES: 'Customer Inquiries',
  SECURITY: 'Security',
  SHOPPING: 'Shopping',
  TRAVEL: 'Travel',
  SOCIAL: 'Social',
  OTHER: 'Other',
};

const AGENT_CATEGORIZATION = {
  name: 'Email Thread Categorization Agent',
  instructionsTemplate: `Categorize the email thread from the following categories based on its content:
- {{categories}}

Only output one of the above categories without any explanation.`,
};

export class EmailMessageService {
  static async createNewEmailMessages() {
    const promiseDataByGmailAccountId: Record<
      string,
      {
        promise?: Promise<void>;
        abortController: AbortController;
        failureCount: number;
        lastFailureAt?: Date;
        ignoredUntil?: Date;
      }
    > = {};

    while (true) {
      const gmailAccounts = (
        await GmailAccountService.findAllAccountsWithBoards({
          populate: ['boardAccounts.board.boardColumns', 'boardAccounts.board.boardMembers'],
        })
      ).filter((acc) => {
        if (acc.state === GmailAccountState.INACTIVE) return false;
        if (![...acc.boardAccounts].some((ba) => ba.loadedBoard.initialized)) return false;
        const promiseData = promiseDataByGmailAccountId[acc.id];
        if (promiseData?.ignoredUntil && promiseData.ignoredUntil > new Date()) return false;
        return true;
      });

      gmailAccounts.forEach((gmailAccount, i) => {
        const existingPromiseData = promiseDataByGmailAccountId[gmailAccount.id];
        if (existingPromiseData?.promise) return; // Already processing

        const promise = RequestContext.create(orm.em, async () => {
          await sleep((i * CREATE_NEW_EMAIL_MESSAGES_GMAIL_API_INTERVAL_MS) / (gmailAccounts.length || 1));
          let promiseData = promiseDataByGmailAccountId[gmailAccount.id];
          try {
            while (promiseData && !promiseData.abortController.signal.aborted) {
              try {
                await EmailMessageService.syncEmailMessagesForGmailAccount(gmailAccount);
                if (promiseData.failureCount > 0) {
                  promiseData.failureCount = 0;
                  promiseData.lastFailureAt = undefined;
                  promiseData.ignoredUntil = undefined;
                }
              } catch (error) {
                reportError(error);
                promiseData.failureCount += 1;
                promiseData.lastFailureAt = new Date();
                if (promiseData.failureCount >= CIRCUIT_BREAKER_FAILURE_THRESHOLD) {
                  if (promiseData.ignoredUntil && promiseData.ignoredUntil <= new Date()) {
                    console.log(`[GMAIL] Marking ${gmailAccount.email} as INACTIVE after repeated failures.`);
                    const freshGmailAccount = await orm.em.findOneOrFail(GmailAccount, gmailAccount.id);
                    freshGmailAccount.markAsInactive();
                    await orm.em.persist(freshGmailAccount).flush();
                  } else {
                    const ignoreUntil = new Date(Date.now() + CIRCUIT_BREAKER_IGNORE_DURATION_MS);
                    console.log(
                      `[GMAIL] Ignoring ${gmailAccount.email} until ${ignoreUntil.toISOString()} after ${promiseData.failureCount} failures.`,
                    );
                    promiseData.ignoredUntil = ignoreUntil;
                  }
                } else {
                  console.log(`[GMAIL] Error syncing ${gmailAccount.email} - ${promiseData.failureCount}`);
                }
                break;
              }
              await sleep(CREATE_NEW_EMAIL_MESSAGES_GMAIL_API_INTERVAL_MS);
              promiseData = promiseDataByGmailAccountId[gmailAccount.id];
            }
          } finally {
            console.log(`[GMAIL] Finished processing new emails for ${gmailAccount.email}`);
            if (promiseData) {
              promiseDataByGmailAccountId[gmailAccount.id]!.promise = undefined;
            }
          }
        });

        if (existingPromiseData) {
          promiseDataByGmailAccountId[gmailAccount.id]!.promise = promise;
        } else {
          promiseDataByGmailAccountId[gmailAccount.id] = {
            promise,
            abortController: new AbortController(),
            failureCount: 0,
            lastFailureAt: undefined as Date | undefined,
            ignoredUntil: undefined as Date | undefined,
          };
        }
      });

      const gmailAccountIds = new Set(gmailAccounts.map((acc) => acc.id));
      for (const gmailAccountId of Object.keys(promiseDataByGmailAccountId)) {
        if (gmailAccountIds.has(gmailAccountId)) continue; // Still exists
        console.log(`[GMAIL] Cancelling sync for account ${gmailAccountId} as it no longer exists.`);
        promiseDataByGmailAccountId[gmailAccountId]!.abortController.abort();
        delete promiseDataByGmailAccountId[gmailAccountId];
      }

      await sleep(CREATE_NEW_EMAIL_MESSAGES_READ_DB_INTERVAL_MS);
    }
  }

  // Creates: EmailMessage, Attachment, *BoardColumn*, Domain, BoardCard
  static async createInitialBoardEmailMessages(boardAccountId: string) {
    const boardAccount = await BoardAccountService.findById(boardAccountId, {
      populate: ['board.boardMembers', 'gmailAccount'],
    });
    const { loadedBoard: board, loadedGmailAccount: gmailAccount } = boardAccount;

    const gmail = await GmailAccountService.initGmail(gmailAccount);
    console.log(`[GMAIL] Fetching ${gmailAccount.email} initial emails in desc order...`);
    const messages = await GmailApi.listMessages(gmail, {
      limit: CREATE_EMAIL_MESSAGES_BATCH_LIMIT,
      emails: boardAccount.receivingEmails,
    });
    if (messages.length === 0) return;

    // Collect EmailMessages and Attachments
    let lastExternalHistoryId: string | undefined;
    const emailMessagesDescByThreadId: Record<string, EmailMessage[]> = {};
    const domainNames = new Set<string>();
    const processedMessageIds = new Set<string>();

    for (const message of messages) {
      if (!message.id) continue;
      console.log(`[GMAIL] Fetching ${gmailAccount.email} message ${message.id}...`);
      const messageData = await GmailApi.getMessage(gmail, message.id);
      if (messageData.labelIds?.includes(LABEL.DRAFT)) continue; // Skip drafts

      const emailMessage = EmailMessageService.parseEmailMessage({ gmailAccount, messageData });
      (emailMessagesDescByThreadId[emailMessage.externalThreadId] ??= []).push(emailMessage);
      domainNames.add(emailMessage.loadedDomain.name);
      processedMessageIds.add(message.id);

      if (!lastExternalHistoryId && messageData.historyId) {
        lastExternalHistoryId = messageData.historyId; // Set lastExternalHistoryId from the first DESC message
      }
    }

    // If receivingEmails exists, fetch complete threads for each unique externalThreadId
    if (boardAccount.receivingEmails) {
      const uniqueThreadIds = Object.keys(emailMessagesDescByThreadId);
      console.log(`[GMAIL] Fetching complete threads for ${uniqueThreadIds.length} threads...`);

      for (const threadId of uniqueThreadIds) {
        console.log(`[GMAIL] Fetching all messages in thread ${threadId}...`);
        const threadData = await GmailApi.getThread(gmail, threadId);

        for (const messageData of threadData.messages || []) {
          if (!messageData.id || processedMessageIds.has(messageData.id)) continue;
          if (messageData.labelIds?.includes(LABEL.DRAFT)) continue; // Skip drafts

          console.log(`[GMAIL] Processing ${gmailAccount.email} thread message ${messageData.id}...`);
          const emailMessage = EmailMessageService.parseEmailMessage({ gmailAccount, messageData });
          (emailMessagesDescByThreadId[emailMessage.externalThreadId] ??= []).push(emailMessage);
          domainNames.add(emailMessage.loadedDomain.name);
          processedMessageIds.add(messageData.id);
        }
      }
    }

    // Categorize email threads
    const emailThreadIdsByCategory: Record<string, string[]> = {};
    for (const [threadId, emailMessages] of Object.entries(emailMessagesDescByThreadId)) {
      const category = await EmailMessageService.categorizeEmailThread({
        categories: Object.values(CATEGORIES),
        emailMessages,
      });
      (emailThreadIdsByCategory[category] ??= []).push(threadId);
    }

    // Find top N categories by number of threads. Always append "Other" category
    const topCategories = Object.entries(emailThreadIdsByCategory)
      .filter(([category]) => category !== CATEGORIES.OTHER)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([category]) => category)
      .slice(0, MAX_INITIAL_BOARD_COUNT - 1);
    topCategories.push(CATEGORIES.OTHER);

    // Find existing Domains
    const existingDomainByName = await DomainService.findDomainByName([...domainNames]);
    const persistDomainOnce = async (domain: Domain) => {
      const existingDomain = existingDomainByName[domain.name];
      if (existingDomain) return existingDomain;

      await DomainService.fetchIcon(domain);
      orm.em.persist(domain);
      existingDomainByName[domain.name] = domain;
      return domain;
    };

    // Create BoardColumns and BoardCards
    const boardColumnsByCategory: Record<string, BoardColumn> = {};
    for (const [initialCategory, threadIds] of Object.entries(emailThreadIdsByCategory)) {
      let category = initialCategory;
      if (!topCategories.includes(category)) {
        category = CATEGORIES.OTHER; // Map less frequent categories to "Other"
      }

      if (!boardColumnsByCategory[category]) {
        const position = topCategories.indexOf(category);
        const boardColumn = new BoardColumn({
          board,
          name: category,
          description: `Emails categorized as '${category}'`,
          position,
        });
        orm.em.persist(boardColumn);
        boardColumnsByCategory[category] = boardColumn;
      }

      for (const threadId of threadIds) {
        // Update or create Domains, create EmailMessages
        for (const emailMessage of emailMessagesDescByThreadId[threadId]!) {
          emailMessage.domain = await persistDomainOnce(emailMessage.loadedDomain);
          orm.em.persist(emailMessage);
        }

        const boardCard = BoardCardService.buildFromEmailMessages({
          gmailAccount,
          boardColumn: boardColumnsByCategory[category]!,
          emailMessagesDesc: emailMessagesDescByThreadId[threadId]!,
        });
        orm.em.persist(boardCard);
      }
    }

    if (lastExternalHistoryId) {
      gmailAccount.setExternalHistoryId(lastExternalHistoryId);
      orm.em.persist(gmailAccount);
    }

    await orm.em.flush();
  }

  static async findLastByExternalThreadId(externalThreadId: string) {
    return orm.em.findOneOrFail(EmailMessage, { externalThreadId }, { orderBy: { externalCreatedAt: 'DESC' } });
  }

  static async findEmailMessagesByBoardCard<Hint extends string = never>(
    boardCard: BoardCard,
    {
      populate,
      orderBy,
      limit,
    }: { populate?: Populate<EmailMessage, Hint>; orderBy?: OrderDefinition<EmailMessage>; limit?: number } = {},
  ) {
    return orm.em.find(
      EmailMessage,
      { gmailAccount: boardCard.gmailAccount, externalThreadId: boardCard.externalThreadId },
      { populate, orderBy, limit },
    );
  }

  static parseParticipant(emailAddress?: string) {
    if (!emailAddress) return;

    const participant = { name: null, email: '' } as Participant;

    const formattedEmail = emailAddress.replaceAll('"', '').trim();

    const match = formattedEmail.match(/^(.*?)(<([^>]+)>)?$/); // Matches 'Name <email>' or just 'email'
    if (match) {
      const namePart = match[1]!.trim();
      const emailPart = match[3] ? match[3].trim() : namePart;
      participant.email = emailPart;
      if (namePart && namePart !== emailPart) {
        participant.name = namePart; // If name part is different from email, use it as name
      }
    } else {
      participant.email = formattedEmail;
    }

    if (participant.email.toLowerCase().startsWith('undisclosed-recipients')) {
      return;
    }

    return participant;
  }

  static parseEmailMessage({
    gmailAccount,
    messageData,
  }: {
    gmailAccount: GmailAccount;
    messageData: gmail_v1.Schema$Message;
  }) {
    const labels = messageData.labelIds || [];
    const headers = messageData.payload?.headers || [];

    const from = EmailMessageService.parseParticipant(GmailApi.headerValue(headers, 'from'))!;
    const to = presence(
      GmailApi.headerValue(headers, 'to')
        ?.split(',')
        .map((e) => e.trim())
        .map(EmailMessageService.parseParticipant)
        .filter((p): p is Participant => !!p),
    );
    const replyTo = EmailMessageService.parseParticipant(GmailApi.headerValue(headers, 'reply-to'));
    const cc = presence(
      GmailApi.headerValue(headers, 'cc')
        ?.split(',')
        .map((e) => e.trim())
        .map(EmailMessageService.parseParticipant)
        .filter((p): p is Participant => !!p),
    );
    const bcc = presence(
      GmailApi.headerValue(headers, 'bcc')
        ?.split(',')
        .map((e) => e.trim())
        .map(EmailMessageService.parseParticipant)
        .filter((p): p is Participant => !!p),
    );

    const { bodyText, bodyHtml } = GmailApi.emailBody(messageData.payload);

    // Gmail sometimes returns future dates
    const parsedInternalDate = new Date(parseInt(messageData.internalDate as string, 10));
    const now = new Date();

    const emailMessage = new EmailMessage({
      gmailAccount,
      domain: new Domain({ name: from.email.split('@')[1]! }),
      externalId: messageData.id as string,
      externalThreadId: messageData.threadId as string,
      externalCreatedAt: parsedInternalDate > now ? now : parsedInternalDate,
      messageId: GmailApi.headerValue(headers, 'message-id'),
      references: GmailApi.headerValue(headers, 'references'),
      from,
      subject: GmailApi.headerValue(headers, 'subject') || FALLBACK_SUBJECT,
      snippet: cheerio.load(messageData.snippet!).text(),
      sent: labels.includes(LABEL.SENT),
      labels,
      to,
      replyTo,
      cc,
      bcc,
      bodyText,
      bodyHtml,
    });

    const attachments: GmailAttachment[] = [];

    for (const attachmentData of GmailApi.attachmentsData(messageData.payload)) {
      const attachment = new GmailAttachment({
        gmailAccount,
        emailMessage,
        externalId: attachmentData.externalId,
        filename: attachmentData.filename,
        mimeType: attachmentData.mimeType,
        size: attachmentData.size,
        contentId: attachmentData.contentId,
      });
      attachments.push(attachment);
    }

    emailMessage.gmailAttachments.set(attachments);
    return emailMessage;
  }

  // -------------------------------------------------------------------------------------------------------------------

  // Creates: EmailMessage, Attachment, Domain, BoardCard
  private static async syncEmailMessagesForGmailAccount(
    gmailAccount: Loaded<GmailAccount, 'boardAccounts.board.boardColumns' | 'boardAccounts.board.boardMembers'>,
  ) {
    const gmail = await GmailAccountService.initGmail(gmailAccount);

    // Fetch changes via Gmail API
    const historyChanges = await EmailMessageService.fetchGmailHistoryChangesAsc({ gmail, gmailAccount });
    let lastExternalHistoryId = historyChanges.lastExternalHistoryId;
    const { addedEmailMessagesIds, deletedExternalEmailMessageIds, labelChanges } = historyChanges;
    if (
      addedEmailMessagesIds.length === 0 &&
      deletedExternalEmailMessageIds.length === 0 &&
      labelChanges.length === 0
    ) {
      if (lastExternalHistoryId && lastExternalHistoryId !== gmailAccount.externalHistoryId) {
        gmailAccount.setExternalHistoryId(lastExternalHistoryId);
        await orm.em.persist(gmailAccount).flush();
      }
      return;
    }

    // Pull all necessary data at once:
    // - Existing affected Email Messages
    const affectedEmailMessages = [
      ...(await orm.em.find(
        EmailMessage,
        {
          gmailAccount,
          externalId: {
            $in: unique([
              ...addedEmailMessagesIds.map((m) => m.externalMessageId),
              ...deletedExternalEmailMessageIds,
              ...labelChanges.map((lc) => lc.externalMessageId),
            ]),
          },
        },
        { populate: ['gmailAttachments', 'domain'] },
      )),
    ] as EmailMessage[];
    const affectedEmailMessageByExternalId = mapBy(affectedEmailMessages, (msg) => msg.externalId);
    // - All email messages in affected threads
    const affectedExternalThreadIds = unique([
      ...affectedEmailMessages.map((msg) => msg.externalThreadId),
      ...addedEmailMessagesIds.map((m) => m.externalThreadId),
    ]);
    const emailMessagesDescByThreadId = groupBy(
      [
        ...(await orm.em.find(
          EmailMessage,
          { gmailAccount, externalThreadId: { $in: affectedExternalThreadIds } },
          { orderBy: { externalCreatedAt: 'DESC' }, populate: ['gmailAttachments'] },
        )),
      ] as EmailMessage[],
      (msg) => msg.externalThreadId,
    );
    // - Board cards
    const boardCardByThreadId = mapBy(
      [
        ...(await BoardCardService.findCardsByExternalThreadIds({
          gmailAccount,
          externalThreadIds: affectedExternalThreadIds,
          populate: ['domain', 'boardCardReadPositions', 'boardColumn.board.boardMembers'],
        })),
      ],
      (boardCard) => boardCard.externalThreadId!,
    );
    // - Board columns
    const boardColumnsAscByBoardId: Record<string, BoardColumn[]> = {};
    for (const boardAccount of gmailAccount.boardAccounts) {
      const boardColumnsAsc = [...boardAccount.loadedBoard.boardColumns].sort((a, b) => a.position - b.position);
      boardColumnsAscByBoardId[boardAccount.board.id] = boardColumnsAsc;
    }

    // Collect EmailMessages & Attachments
    console.log(`[GMAIL] Processing additions for ${gmailAccount.email}...`);
    const domainNames = new Set<string>();
    const alreadDeletedExternalMessageIds = new Set();
    const draftExternalMessageIds = new Set<string>();
    for (const addedEmailMessageIds of addedEmailMessagesIds) {
      const { externalMessageId, externalThreadId } = addedEmailMessageIds;
      const emailMessageAlreadyExists = !!affectedEmailMessageByExternalId[externalMessageId];
      if (emailMessageAlreadyExists) continue;

      try {
        console.log(`[GMAIL] Fetching ${gmailAccount.email} message ${externalMessageId}...`);
        const messageData = await GmailApi.getMessage(gmail, externalMessageId);
        if (messageData.labelIds?.includes(LABEL.DRAFT)) {
          draftExternalMessageIds.add(externalMessageId);
          continue; // Skip drafts
        }

        const emailMessage = EmailMessageService.parseEmailMessage({ gmailAccount, messageData });
        const boardCard = boardCardByThreadId[externalThreadId];

        if (!boardCard && !EmailMessageService.boardAccountToSyncWhenNoBoardCard({ emailMessage, gmailAccount })) {
          console.log(`[GMAIL] Skipping message ${externalMessageId} - does not match sync criteria`);
          continue;
        }

        affectedEmailMessageByExternalId[externalMessageId] = emailMessage;
        emailMessagesDescByThreadId[externalThreadId] = [
          emailMessage,
          ...(emailMessagesDescByThreadId[externalThreadId] || []),
        ];
        domainNames.add(emailMessage.loadedDomain.name);

        if (!lastExternalHistoryId && messageData.historyId) {
          lastExternalHistoryId = messageData.historyId; // Set lastExternalHistoryId from the first DESC message if not set from history
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('Requested entity was not found')) {
          console.log(`[GMAIL] Message ${externalMessageId} for ${gmailAccount.email} was not found.`);
          alreadDeletedExternalMessageIds.add(externalMessageId);
        } else {
          reportError(error);
          throw error;
        }
      }
    }
    // Load domains
    const existingDomainByName = await DomainService.findDomainByName([...domainNames]);
    const persistDomainOnce = async (domain: Domain) => {
      const existingDomain = existingDomainByName[domain.name];
      if (existingDomain) return existingDomain;

      await DomainService.fetchIcon(domain);
      orm.em.persist(domain);
      existingDomainByName[domain.name] = domain;
      return domain;
    };
    // Handle add: create or update Domains & BoardCards
    for (const externalMessageIds of addedEmailMessagesIds) {
      const { externalMessageId, externalThreadId } = externalMessageIds;
      if (alreadDeletedExternalMessageIds.has(externalMessageId)) continue; // Skip already deleted messages (404)
      if (draftExternalMessageIds.has(externalMessageId)) continue; // Skip drafts

      const emailMessage = affectedEmailMessageByExternalId[externalMessageId];
      if (!emailMessage) continue; // Skipped message

      const boardCard = boardCardByThreadId[externalThreadId];
      const emailMessagesDesc = emailMessagesDescByThreadId[externalThreadId]!;

      // Update or create Domains, create EmailMessages
      emailMessage.domain = await persistDomainOnce(emailMessage.loadedDomain);
      orm.em.persist(emailMessage);

      if (boardCard) {
        const rebuiltBoardCard = BoardCardService.rebuildFromEmailMessages({ boardCard, emailMessagesDesc });
        orm.em.persist(rebuiltBoardCard);
        boardCardByThreadId[externalThreadId] = rebuiltBoardCard;
      } else {
        const boardAccount = EmailMessageService.boardAccountToSyncWhenNoBoardCard({ emailMessage, gmailAccount })!;
        const boardColumnsAsc = boardColumnsAscByBoardId[boardAccount.board.id]!;
        const category = await EmailMessageService.categorizeEmailThread({
          categories: boardColumnsAsc.map((col) => col.name),
          emailMessages: emailMessagesDesc,
        });
        const boardCard = BoardCardService.buildFromEmailMessages({
          gmailAccount,
          boardColumn: boardColumnsAsc.find((col) => col.name === category) || boardColumnsAsc[0]!,
          emailMessagesDesc,
        });
        orm.em.persist(boardCard);
        boardCardByThreadId[externalThreadId] = boardCard as (typeof boardCardByThreadId)[string];
      }
    }

    // Handle delete: delete EmailMessages, update/delete BoardCards
    console.log(`[GMAIL] Processing deletions for ${gmailAccount.email}...`);
    for (const externalMessageId of deletedExternalEmailMessageIds) {
      const emailMessageToDelete = affectedEmailMessageByExternalId[externalMessageId];
      if (!emailMessageToDelete) continue; // Already deleted

      orm.em.remove(emailMessageToDelete);
      delete affectedEmailMessageByExternalId[externalMessageId];

      const threadId = emailMessageToDelete.externalThreadId;
      const emailMessagesDesc = emailMessagesDescByThreadId[threadId]!.filter(
        (msg) => msg.externalId !== externalMessageId,
      );
      emailMessagesDescByThreadId[threadId] = emailMessagesDesc;

      let boardCard = boardCardByThreadId[threadId]!;

      if (emailMessagesDesc.length === 0) {
        orm.em.remove(boardCard);
        delete boardCardByThreadId[threadId];
      } else {
        boardCard = BoardCardService.rebuildFromEmailMessages({ boardCard, emailMessagesDesc });
        orm.em.persist(boardCard);
        boardCardByThreadId[threadId] = boardCard;
      }
    }

    // Handle label changes (read / unread / trash / spam): update EmailMessages, update BoardCards
    console.log(`[GMAIL] Processing label changes for ${gmailAccount.email}...`);
    for (const labelChange of labelChanges) {
      const { externalMessageId } = labelChange;
      const emailMessage = affectedEmailMessageByExternalId[externalMessageId];
      if (!emailMessage) continue; // Message not found

      const labels = labelChange.added
        ? unique([...emailMessage.labels, ...labelChange.added])
        : emailMessage.labels.filter((labelId) => !labelChange.removed!.includes(labelId));
      emailMessage.setLabels(labels);

      orm.em.persist(emailMessage);
      affectedEmailMessageByExternalId[externalMessageId] = emailMessage;

      const threadId = emailMessage.externalThreadId;
      const emailMessagesDesc = emailMessagesDescByThreadId[threadId]!.map((msg) =>
        msg.externalId === externalMessageId ? emailMessage : msg,
      );
      emailMessagesDescByThreadId[threadId] = emailMessagesDesc;

      let boardCard = boardCardByThreadId[threadId]!;
      boardCard = BoardCardService.rebuildFromEmailMessages({ boardCard, emailMessagesDesc });
      orm.em.persist(boardCard);
      boardCardByThreadId[threadId] = boardCard;
    }

    if (lastExternalHistoryId) {
      gmailAccount.setExternalHistoryId(lastExternalHistoryId);
      orm.em.persist(gmailAccount);
    }

    await orm.em.flush();
  }

  private static boardAccountToSyncWhenNoBoardCard({
    emailMessage,
    gmailAccount,
  }: {
    emailMessage: EmailMessage;
    gmailAccount: Loaded<GmailAccount, 'boardAccounts'>;
  }) {
    // Sent outside Bordly
    if (emailMessage.sent) {
      return gmailAccount.boardAccounts.find(
        (boardAccount) => boardAccount.syncAll || boardAccount.receivingEmails!.includes(emailMessage.from.email),
      );
    }

    const recipientEmails = [...(emailMessage.to || []), ...(emailMessage.cc || []), ...(emailMessage.bcc || [])].map(
      (p) => p.email,
    );

    return gmailAccount.boardAccounts.find((boardAccount) => {
      if (boardAccount.syncAll) return true;

      const receivingEmails = boardAccount.receivingEmails!;
      return recipientEmails.some((email) => receivingEmails.includes(email));
    });
  }

  private static async fetchGmailHistoryChangesAsc({
    gmail,
    gmailAccount,
  }: {
    gmail: gmail_v1.Gmail;
    gmailAccount: Loaded<GmailAccount, 'boardAccounts'>;
  }) {
    const addedEmailMessagesIds: { externalMessageId: string; externalThreadId: string }[] = [];
    const deletedExternalEmailMessageIds: string[] = [];
    const labelChanges: { externalMessageId: string; added?: string[]; removed?: string[] }[] = [];
    let lastExternalHistoryId = gmailAccount.externalHistoryId;
    if (gmailAccount.externalHistoryId) {
      console.log(`[GMAIL] Fetching ${gmailAccount.email} history since ${gmailAccount.externalHistoryId}...`);
      let pageToken: string | undefined;
      do {
        const { historyItems, nextPageToken, historyId } = await GmailApi.listHistory(gmail, {
          startHistoryId: lastExternalHistoryId,
          pageToken,
        });

        for (const history of historyItems) {
          for (const messageAdded of history.messagesAdded || []) {
            if (messageAdded.message?.id)
              addedEmailMessagesIds.push({
                externalMessageId: messageAdded.message.id,
                externalThreadId: messageAdded.message.threadId!,
              });
          }
          for (const messageDeleted of history.messagesDeleted || []) {
            if (messageDeleted.message?.id) deletedExternalEmailMessageIds.push(messageDeleted.message.id);
          }
          for (const labelAdded of history.labelsAdded || []) {
            if (labelAdded.message?.id) {
              labelChanges.push({ externalMessageId: labelAdded.message.id, added: labelAdded.labelIds || undefined });
            }
          }
          for (const labelRemoved of history.labelsRemoved || []) {
            if (labelRemoved.message?.id) {
              labelChanges.push({
                externalMessageId: labelRemoved.message.id,
                removed: labelRemoved.labelIds || undefined,
              });
            }
          }
        }
        pageToken = nextPageToken;
        if (historyId) lastExternalHistoryId = historyId;
      } while (pageToken);
    } else {
      console.log(`[GMAIL] Fetching ${gmailAccount.email} initial emails...`);
      const allReceivingEmails = unique(
        gmailAccount.boardAccounts.filter((ba) => !!ba.receivingEmails).flatMap((ba) => ba.receivingEmails!),
      );
      const messages = await GmailApi.listMessages(gmail, {
        limit: CREATE_EMAIL_MESSAGES_BATCH_LIMIT,
        emails: allReceivingEmails.length > 0 ? allReceivingEmails : undefined,
      });
      addedEmailMessagesIds.push(...messages.map((m) => ({ externalMessageId: m.id!, externalThreadId: m.threadId! })));
    }

    return {
      lastExternalHistoryId,
      addedEmailMessagesIds,
      deletedExternalEmailMessageIds: unique(deletedExternalEmailMessageIds),
      labelChanges,
    };
  }

  private static async categorizeEmailThread({
    categories,
    emailMessages,
  }: {
    categories: string[];
    emailMessages: EmailMessage[];
  }) {
    const agent = AgentService.createAgent({
      name: AGENT_CATEGORIZATION.name,
      instructions: renderTemplate(AGENT_CATEGORIZATION.instructionsTemplate, { categories: categories.join('\n- ') }),
    });

    let category = CATEGORIES.OTHER;
    if (
      !emailMessages.some(
        (emailMessage) => emailMessage.labels.includes(LABEL.SPAM) || emailMessage.labels.includes(LABEL.TRASH),
      )
    ) {
      console.log(`[AGENT] Categorizing emails ${emailMessages.map((e) => e.externalId).join(', ')}...`);
      const emailMessageContents = emailMessages.map(
        (e) => `From: ${e.from}
Subject: ${e.subject}
Snippet: ${e.snippet}`,
      );

      const response = await agent.generate([
        {
          role: 'user',
          content: `Categorize the following email thread:

${emailMessageContents.join('\n\n---\n\n')}`,
        },
      ]);
      category = response.text;
    }

    return category;
  }
}
