import type { Populate } from '@mikro-orm/postgresql';
import { RequestContext } from '@mikro-orm/postgresql';
import * as cheerio from 'cheerio';
import type { gmail_v1 } from 'googleapis/build/src/apis/gmail/v1';
import { Attachment } from '@/entities/attachment';
import type { Board } from '@/entities/board';
import { BoardColumn } from '@/entities/board-column';
import { Domain } from '@/entities/domain';
import { EmailMessage, type Participant } from '@/entities/email-message';
import type { GmailAccount } from '@/entities/gmail-account';
import { AgentService } from '@/services/agent.service';
import { BoardCardService } from '@/services/board-card.service';
import { DomainService } from '@/services/domain.service';
import { GmailAccountService } from '@/services/gmail-account.service';
import { ENV } from '@/utils/env';
import { reportError } from '@/utils/error-tracking';
import { GoogleApi, LABEL } from '@/utils/google-api';
import { groupBy, mapBy, presence, unique } from '@/utils/lists';
import { orm } from '@/utils/orm';
import { renderTemplate } from '@/utils/strings';
import { sleep } from '@/utils/time';

const CREATE_NEW_EMAIL_MESSAGES_READ_DB_INTERVAL_MS = 60 * 1_000; // 60 seconds
const CREATE_NEW_EMAIL_MESSAGES_GMAIL_API_INTERVAL_MS = 5 * 1_000; // 5 seconds
const CREATE_EMAIL_MESSAGES_BATCH_LIMIT = ENV.NODE_ENV === 'production' ? 30 : 10;
const MAX_INITIAL_BOARD_COUNT = 5;

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
    const promiseDataByGmailAccountId: Record<string, { promise: Promise<void>; abortController: AbortController }> =
      {};

    while (true) {
      const gmailAccounts = (
        await GmailAccountService.findAllAccountsWithBoards({ populate: ['board.boardColumns'] })
      ).filter((acc) => acc.board?.initialized);

      const gmailAccountIds = new Set(gmailAccounts.map((acc) => acc.id));

      gmailAccounts.forEach((gmailAccount, i) => {
        if (promiseDataByGmailAccountId[gmailAccount.id]) return; // Already processing

        const abortController = new AbortController();
        const promise = RequestContext.create(orm.em, async () => {
          await sleep((i * CREATE_NEW_EMAIL_MESSAGES_GMAIL_API_INTERVAL_MS) / (gmailAccounts.length || 1));

          try {
            while (!abortController.signal.aborted) {
              await EmailMessageService.syncEmailMessagesForGmailAccount(gmailAccount);
              await sleep(CREATE_NEW_EMAIL_MESSAGES_GMAIL_API_INTERVAL_MS);
            }
          } catch (error) {
            reportError(error);
          } finally {
            console.log(`[GMAIL] Finished processing new emails for ${gmailAccount.email}.`);
            delete promiseDataByGmailAccountId[gmailAccount.id];
          }
        });
        promiseDataByGmailAccountId[gmailAccount.id] = { promise, abortController };
      });

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
  static async createInitialBoardEmailMessages(gmailAccountId: string) {
    const gmailAccount = await GmailAccountService.findById(gmailAccountId, { populate: ['board'] });
    if (!gmailAccount.board) throw new Error('Gmail account does not have an associated board');

    const gmail = await GmailAccountService.initGmail(gmailAccount);
    console.log(`[GMAIL] Fetching ${gmailAccount.email} initial emails in desc order...`);
    const messages = await GoogleApi.gmailListMessages(gmail, { limit: CREATE_EMAIL_MESSAGES_BATCH_LIMIT });
    if (messages.length === 0) return;

    // Collect EmailMessages and Attachments
    let lastExternalHistoryId: string | undefined;
    const emailMessagesDescByThreadId: Record<string, EmailMessage[]> = {};
    const domainNames = new Set<string>();
    for (const message of messages) {
      if (!message.id) continue;
      console.log(`[GMAIL] Fetching ${gmailAccount.email} message ${message.id}...`);
      const messageData = await GoogleApi.gmailGetMessage(gmail, message.id);
      const emailMessage = EmailMessageService.parseEmailMessage({ gmailAccount, messageData });

      (emailMessagesDescByThreadId[emailMessage.externalThreadId] ??= []).push(emailMessage);
      domainNames.add(emailMessage.domain.name);
      // We also want to read domain names for board cards (they don't use the "From" field for sent emails)
      domainNames.add(BoardCardService.emailMessageParticipantsAsc(emailMessage)[0]!.email.split('@')[1]!);

      if (!lastExternalHistoryId && messageData.historyId) {
        lastExternalHistoryId = messageData.historyId; // Set lastExternalHistoryId from the first DESC message
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
          board: gmailAccount.board,
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
          emailMessage.domain = await persistDomainOnce(emailMessage.domain);
          orm.em.persist(emailMessage);
        }

        const boardCard = BoardCardService.buildFromEmailMessages({
          gmailAccount,
          boardColumn: boardColumnsByCategory[category]!,
          emailMessagesDesc: emailMessagesDescByThreadId[threadId]!,
        });
        boardCard.domain = await persistDomainOnce(boardCard.domain);
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

  static async findEmailMessages<Hint extends string = never>(
    board: Board,
    { boardCardId, populate }: { boardCardId: string; populate?: Populate<EmailMessage, Hint> },
  ) {
    const boardCard = await BoardCardService.findById(board, { boardCardId, populate: ['boardColumn', 'emailDraft'] });
    const emailMessagesAsc = await orm.em.find(
      EmailMessage,
      { gmailAccount: boardCard.gmailAccount, externalThreadId: boardCard.externalThreadId },
      { populate, orderBy: { externalCreatedAt: 'ASC' } },
    );
    return { boardCard, emailMessagesAsc };
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

  // -------------------------------------------------------------------------------------------------------------------

  // Creates: EmailMessage, Attachment, Domain, BoardCard
  private static async syncEmailMessagesForGmailAccount(gmailAccount: GmailAccount) {
    const gmail = await GmailAccountService.initGmail(gmailAccount);

    // Fetch changes via Gmail API
    const historyChanges = await EmailMessageService.fetchGmailHistoryChanges({ gmail, gmailAccount });
    let lastExternalHistoryId = historyChanges.lastExternalHistoryId;
    const { externalEmailMessageIdsToAdd, externalEmailMessageIdsToDelete, labelChanges } = historyChanges;
    if (
      externalEmailMessageIdsToAdd.length === 0 &&
      externalEmailMessageIdsToDelete.length === 0 &&
      labelChanges.length === 0
    ) {
      if (lastExternalHistoryId && lastExternalHistoryId !== gmailAccount.externalHistoryId) {
        gmailAccount.setExternalHistoryId(lastExternalHistoryId);
        await orm.em.persist(gmailAccount).flush();
      }
      return;
    }

    // Pull all necessary data at once:
    // - Affected Email Messages
    const affectedEmailMessageIds = unique([
      ...externalEmailMessageIdsToAdd,
      ...externalEmailMessageIdsToDelete,
      ...labelChanges.map((lc) => lc.externalMessageId),
    ]);
    const affectedEmailMessages = await orm.em.find(
      EmailMessage,
      { gmailAccount, externalId: { $in: affectedEmailMessageIds } },
      { populate: ['attachments'] },
    );
    const affectedEmailMessageByExternalId = mapBy(affectedEmailMessages, (msg) => msg.externalId) as Record<
      string,
      EmailMessage
    >;
    // - All email messages in affected threads
    const externalThreadIds = unique(affectedEmailMessages.map((msg) => msg.externalThreadId));
    const emailMessagesDescByThreadId = groupBy(
      await orm.em.find(
        EmailMessage,
        { gmailAccount, externalThreadId: { $in: externalThreadIds } },
        { orderBy: { externalCreatedAt: 'DESC' }, populate: ['attachments'] },
      ),
      (msg) => msg.externalThreadId,
    ) as Record<string, EmailMessage[]>;
    // - Board cards
    const boardCardByThreadId = await BoardCardService.findAndBuildBoardCardByThreadId({
      gmailAccount,
      externalThreadIds,
      populate: ['domain'],
    });
    // - Board columns
    const boardColumnsAsc = gmailAccount.board!.boardColumns.getItems().sort((a, b) => a.position - b.position);

    // Handle add: collect EmailMessages & Attachments
    console.log(`[GMAIL] Processing additions for ${gmailAccount.email}...`);
    const domainNames = new Set<string>();
    const alreadDeletedExternalMessageIds = new Set();
    for (const externalMessageId of externalEmailMessageIdsToAdd) {
      const emailMessageToCreate = affectedEmailMessageByExternalId[externalMessageId];
      if (emailMessageToCreate) continue; // Already exists

      try {
        console.log(`[GMAIL] Fetching ${gmailAccount.email} message ${externalMessageId}...`);
        const messageData = await GoogleApi.gmailGetMessage(gmail, externalMessageId);
        const emailMessage = EmailMessageService.parseEmailMessage({ gmailAccount, messageData });
        affectedEmailMessageByExternalId[externalMessageId] = emailMessage;

        const threadId = emailMessage.externalThreadId;
        const emailMessagesDesc = [emailMessage, ...(emailMessagesDescByThreadId[threadId] || [])];
        emailMessagesDescByThreadId[threadId] = emailMessagesDesc;

        domainNames.add(emailMessage.domain.name);
        // We also want to read domain names for board cards (they don't use the "From" field for sent emails)
        domainNames.add(BoardCardService.emailMessageParticipantsAsc(emailMessage)[0]!.email.split('@')[1]!);

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
    for (const externalMessageId of externalEmailMessageIdsToAdd) {
      if (alreadDeletedExternalMessageIds.has(externalMessageId)) continue; // Skip already deleted messages (404)

      const emailMessage = affectedEmailMessageByExternalId[externalMessageId]!;
      const threadId = emailMessage.externalThreadId;
      const emailMessagesDesc = emailMessagesDescByThreadId[threadId]!;

      // Update or create Domains, create EmailMessages
      for (const emailMessage of emailMessagesDesc) {
        emailMessage.domain = await persistDomainOnce(emailMessage.domain);
        orm.em.persist(emailMessage);
      }

      const boardCard = boardCardByThreadId[threadId];
      if (boardCard) {
        const rebuiltBoardCard = BoardCardService.rebuildFromEmailMessages({
          boardCard,
          gmailAccount,
          emailMessagesDesc,
        });
        orm.em.persist(rebuiltBoardCard);
        boardCardByThreadId[threadId] = rebuiltBoardCard;
      } else {
        const category = await EmailMessageService.categorizeEmailThread({
          categories: boardColumnsAsc.map((col) => col.name),
          emailMessages: emailMessagesDesc,
        });
        const boardCard = BoardCardService.buildFromEmailMessages({
          gmailAccount,
          boardColumn: boardColumnsAsc.find((col) => col.name === category) || boardColumnsAsc[0]!,
          emailMessagesDesc,
        });
        boardCard.domain = await persistDomainOnce(boardCard.domain);
        orm.em.persist(boardCard);
        boardCardByThreadId[threadId] = boardCard;
      }
    }

    // Handle delete: delete EmailMessages, update/delete BoardCards
    console.log(`[GMAIL] Processing deletions for ${gmailAccount.email}...`);
    for (const externalMessageId of externalEmailMessageIdsToDelete) {
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
        boardCard = BoardCardService.rebuildFromEmailMessages({ boardCard, gmailAccount, emailMessagesDesc });
        orm.em.persist(boardCard);
        boardCardByThreadId[threadId] = boardCard;
      }
    }

    // Handle label changes: update EmailMessages, update BoardCards
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
      boardCard = BoardCardService.rebuildFromEmailMessages({
        boardCard,
        gmailAccount,
        emailMessagesDesc,
      });
      orm.em.persist(boardCard);
      boardCardByThreadId[threadId] = boardCard;
    }

    if (lastExternalHistoryId) {
      gmailAccount.setExternalHistoryId(lastExternalHistoryId);
      orm.em.persist(gmailAccount);
    }

    await orm.em.flush();
  }

  private static async fetchGmailHistoryChanges({
    gmail,
    gmailAccount,
  }: {
    gmail: gmail_v1.Gmail;
    gmailAccount: GmailAccount;
  }) {
    const externalEmailMessageIdsToAdd: string[] = [];
    const externalEmailMessageIdsToDelete: string[] = [];
    const labelChanges: { externalMessageId: string; added?: string[]; removed?: string[] }[] = [];
    let lastExternalHistoryId = gmailAccount.externalHistoryId;
    if (gmailAccount.externalHistoryId) {
      console.log(`[GMAIL] Fetching ${gmailAccount.email} history since ${gmailAccount.externalHistoryId}...`);
      let pageToken: string | undefined;
      do {
        const { historyItems, nextPageToken, historyId } = await GoogleApi.gmailListHistory(gmail, {
          startHistoryId: lastExternalHistoryId,
          pageToken,
        });

        for (const history of historyItems) {
          for (const messageAdded of history.messagesAdded || []) {
            if (messageAdded.message?.id) externalEmailMessageIdsToAdd.push(messageAdded.message.id);
          }
          for (const messageDeleted of history.messagesDeleted || []) {
            if (messageDeleted.message?.id) externalEmailMessageIdsToDelete.push(messageDeleted.message.id);
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
      const messages = await GoogleApi.gmailListMessages(gmail, { limit: CREATE_EMAIL_MESSAGES_BATCH_LIMIT });
      externalEmailMessageIdsToAdd.push(...messages.map((m) => m.id).filter((id): id is string => !!id));
    }

    return {
      lastExternalHistoryId,
      externalEmailMessageIdsToAdd: unique(externalEmailMessageIdsToAdd),
      externalEmailMessageIdsToDelete: unique(externalEmailMessageIdsToDelete),
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

  private static parseEmailMessage({
    gmailAccount,
    messageData,
  }: {
    gmailAccount: GmailAccount;
    messageData: gmail_v1.Schema$Message;
  }) {
    const labels = messageData.labelIds || [];
    const headers = messageData.payload?.headers || [];

    const from = EmailMessageService.parseParticipant(GoogleApi.gmailHeaderValue(headers, 'from'))!;
    const to = presence(
      GoogleApi.gmailHeaderValue(headers, 'to')
        ?.split(',')
        .map((e) => e.trim())
        .map(EmailMessageService.parseParticipant)
        .filter((p): p is Participant => !!p),
    );
    const replyTo = EmailMessageService.parseParticipant(GoogleApi.gmailHeaderValue(headers, 'reply-to'));
    const cc = presence(
      GoogleApi.gmailHeaderValue(headers, 'cc')
        ?.split(',')
        .map((e) => e.trim())
        .map(EmailMessageService.parseParticipant)
        .filter((p): p is Participant => !!p),
    );
    const bcc = presence(
      GoogleApi.gmailHeaderValue(headers, 'bcc')
        ?.split(',')
        .map((e) => e.trim())
        .map(EmailMessageService.parseParticipant)
        .filter((p): p is Participant => !!p),
    );

    const { bodyText, bodyHtml } = GoogleApi.gmailBody(messageData.payload);

    // Gmail sometimes returns future dates
    const parsedInternalDate = new Date(parseInt(messageData.internalDate as string, 10));
    const now = new Date();

    const emailMessage = new EmailMessage({
      gmailAccount,
      domain: new Domain({ name: from.email.split('@')[1]! }),
      externalId: messageData.id as string,
      externalThreadId: messageData.threadId as string,
      externalCreatedAt: parsedInternalDate > now ? now : parsedInternalDate,
      from,
      subject: GoogleApi.gmailHeaderValue(headers, 'subject') as string,
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

    const attachments: Attachment[] = [];

    for (const attachmentData of GoogleApi.gmailAttachmentsData(messageData.payload)) {
      const attachment = new Attachment({
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

    emailMessage.attachments.set(attachments);
    return emailMessage;
  }
}
