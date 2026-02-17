import * as cheerio from 'cheerio';
import type { gmail_v1 } from 'googleapis/build/src/apis/gmail/v1';

import { Attachment } from '@/entities/attachment';
import { BoardColumn } from '@/entities/board-column';
import { Domain } from '@/entities/domain';
import { EmailMessage, type Participant } from '@/entities/email-message';
import type { GmailAccount } from '@/entities/gmail-account';
import { AgentService } from '@/services/agent.service';
import { BoardCardService } from '@/services/board-card.service';
import { DomainService } from '@/services/domain.service';
import { GmailAccountService } from '@/services/gmail-account.service';
import { GoogleApi, LABEL } from '@/utils/google-api';
import { groupBy, mapBy, presence, unique } from '@/utils/lists';
import { orm } from '@/utils/orm';
import { renderTemplate } from '@/utils/strings';
import { sleep } from '@/utils/time';

const CREATE_EMAIL_MESSAGES_BATCH_LIMIT = 50;
const MAX_INITIAL_BOARD_COUNT = 5;
const CREATE_NEW_EMAIL_MESSAGES_INTERVAL_MS = 20 * 1_000; // 20 seconds

const CATEGORIES = {
  ENGINEERING: 'Engineering',
  FINANCE: 'Finance',
  MEETINGS: 'Meetings',
  PROMOTIONS: 'Promotions',
  SCHOOL: 'School',
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
  static async loopCreateNewEmailMessages() {
    while (true) {
      const gmailAccounts = await GmailAccountService.findAllAccountsWithBoards({ populate: ['board.boardColumns'] });
      for (const gmailAccount of gmailAccounts) {
        await EmailMessageService.syncEmailMessagesForGmailAccount(gmailAccount);
      }
      await sleep(CREATE_NEW_EMAIL_MESSAGES_INTERVAL_MS);
    }
  }

  // Creates: EmailMessage, Attachment, *BoardColumn*, Domain, BoardCard
  static async createInitialBoardEmailMessages(gmailAccountId: string) {
    const gmailAccount = await GmailAccountService.findById(gmailAccountId, { populate: ['board'] });
    if (!gmailAccount.board) throw new Error('Gmail account does not have an associated board');

    const { oauth2Client } = await GmailAccountService.refreshAccessToken(gmailAccount);
    const gmail = GoogleApi.newGmail(oauth2Client);

    console.log(`[GMAIL] Fetching ${gmailAccount.email} initial emails in desc order...`);
    const messages = await GoogleApi.gmailListMessages(gmail, { limit: CREATE_EMAIL_MESSAGES_BATCH_LIMIT });
    if (messages.length === 0) return;

    // Create EmailMessages and Attachments
    const emailMessagesDescByThreadId: Record<string, EmailMessage[]> = {};
    for (const message of messages) {
      if (!message.id) continue;
      console.log(`[GMAIL] Fetching ${gmailAccount.email} message ${message.id}...`);
      const messageData = await GoogleApi.gmailGetMessage(gmail, message.id);
      const { emailMessage, attachments } = EmailMessageService.parseEmailMessage({ gmailAccount, messageData });
      orm.em.persist([emailMessage, ...attachments]);
      (emailMessagesDescByThreadId[emailMessage.externalThreadId] ??= []).push(emailMessage);
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

    // Collect domain names
    const domainByName = await EmailMessageService.findDomainByName(emailMessagesDescByThreadId);

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
        const emailMessagesDesc = emailMessagesDescByThreadId[threadId]!;
        const domainName = EmailMessageService.domainName(emailMessagesDesc);

        let domain = domainByName[domainName];
        if (!domain) {
          domain = new Domain({ name: domainName });
          domain.setIconUrl(await DomainService.fetchIconUrl(domain));
          orm.em.persist(domain);
        } else if (!domain.iconUrl) {
          domain.setIconUrl(await DomainService.fetchIconUrl(domain));
          if (domain.iconUrl) orm.em.persist(domain);
        }
        domainByName[domain.name] = domain;

        const boardCard = BoardCardService.buildFromEmailMessages({
          gmailAccount,
          boardColumn: boardColumnsByCategory[category]!,
          emailMessagesDesc: emailMessagesDescByThreadId[threadId]!,
          domain,
        });
        orm.em.persist(boardCard);
      }
    }

    await orm.em.flush();
  }

  // Make unique by email, preferring participants with names
  static uniqueParticipantsAsc({
    emailMessagesDesc,
    gmailAccount,
  }: {
    emailMessagesDesc: EmailMessage[];
    gmailAccount: GmailAccount;
  }) {
    const participantsAsc = emailMessagesDesc
      .reverse()
      .flatMap((msg) =>
        msg.sent
          ? [...(msg.to || []), ...(msg.cc || []), ...(msg.bcc || [])]
          : [msg.from, ...(msg.to || []), ...(msg.cc || [])],
      )
      .filter((p) => p.email !== gmailAccount.email);

    const participantsByEmail: { [email: string]: Participant } = {};
    const uniqueParticipants: Participant[] = [];

    for (const participant of participantsAsc) {
      const existing = participantsByEmail[participant.email];
      if (!existing) {
        participantsByEmail[participant.email] = participant;
        uniqueParticipants.push(participant);
      } else if (participant.name && !existing.name) {
        participantsByEmail[participant.email] = participant;
        const index = uniqueParticipants.findIndex((p) => p.email === participant.email);
        if (index !== -1) {
          uniqueParticipants[index] = participant;
        }
      }
    }

    return uniqueParticipants;
  }

  static async findLastByExternalThreadId(externalThreadId: string) {
    return orm.em.findOneOrFail(EmailMessage, { externalThreadId }, { orderBy: { externalCreatedAt: 'DESC' } });
  }

  // -------------------------------------------------------------------------------------------------------------------

  // Creates: EmailMessage, Attachment, Domain, BoardCard
  private static async syncEmailMessagesForGmailAccount(gmailAccount: GmailAccount) {
    if (!gmailAccount.board?.initialized) {
      console.log(`[GMAIL] Skipping ${gmailAccount.email} new emails fetch as board is not initialized.`);
      return;
    }
    const { oauth2Client } = await GmailAccountService.refreshAccessToken(gmailAccount);
    const gmail = GoogleApi.newGmail(oauth2Client);

    // Fetch changes via Gmail API
    const historyChanges = await EmailMessageService.fetchGmailHistoryChanges({ gmail, gmailAccount });
    let lastExternalHistoryId = historyChanges.lastExternalHistoryId;
    const { externalEmailMessageIdsToAdd, externalEmailMessageIdsToDelete, labelChanges } = historyChanges;
    if (
      externalEmailMessageIdsToAdd.length === 0 &&
      externalEmailMessageIdsToDelete.length === 0 &&
      labelChanges.length === 0
    ) {
      return;
    }

    // Pull all necessary data at once:
    // - Affected Email Messages
    const affectedEmailMessages = await orm.em.find(EmailMessage, {
      gmailAccount,
      externalId: {
        $in: [
          ...externalEmailMessageIdsToAdd,
          ...externalEmailMessageIdsToDelete,
          ...labelChanges.map((lc) => lc.externalMessageId),
        ],
      },
    });
    const affectedEmailMessageByExternalId = mapBy(affectedEmailMessages, (msg) => msg.externalId);
    // - All email messages in affected threads
    const externalThreadIds = unique(affectedEmailMessages.map((msg) => msg.externalThreadId));
    const emailMessagesDescByThreadId = groupBy(
      await orm.em.find(
        EmailMessage,
        { gmailAccount, externalThreadId: { $in: externalThreadIds } },
        { orderBy: { externalCreatedAt: 'DESC' } },
      ),
      (msg) => msg.externalThreadId,
    );
    // - Board cards
    const boardCardByThreadId = await BoardCardService.findAndBuildBoardCardByThreadId({
      gmailAccount,
      externalThreadIds,
      populate: ['domain'],
    });
    // - Board columns
    const boardColumnsAsc = gmailAccount.board.boardColumns.getItems().sort((a, b) => a.position - b.position);

    // Handle add: create EmailMessages & Attachments
    for (const externalMessageId of externalEmailMessageIdsToAdd) {
      const emailMessageToCreate = affectedEmailMessageByExternalId[externalMessageId];
      if (emailMessageToCreate) continue; // Already exists

      console.log(`[GMAIL] Fetching ${gmailAccount.email} message ${externalMessageId}...`);
      const messageData = await GoogleApi.gmailGetMessage(gmail, externalMessageId);
      const { emailMessage, attachments } = EmailMessageService.parseEmailMessage({ gmailAccount, messageData });
      orm.em.persist([emailMessage, ...attachments]);
      affectedEmailMessageByExternalId[externalMessageId] = emailMessage;

      const threadId = emailMessage.externalThreadId;
      const emailMessagesDesc = [emailMessage, ...(emailMessagesDescByThreadId[threadId] || [])];
      emailMessagesDescByThreadId[threadId] = emailMessagesDesc;

      if (!lastExternalHistoryId && messageData.historyId) {
        lastExternalHistoryId = messageData.historyId; // Set lastExternalHistoryId if not set from the first DESC message
      }
    }
    // Load domains
    const domainByName = await EmailMessageService.findDomainByName(emailMessagesDescByThreadId);
    // Handle add: create or update Domains & BoardCards
    for (const externalMessageId of externalEmailMessageIdsToAdd) {
      const emailMessage = affectedEmailMessageByExternalId[externalMessageId]!;
      const threadId = emailMessage.externalThreadId;
      const emailMessagesDesc = emailMessagesDescByThreadId[threadId]!;

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
        const domainName = EmailMessageService.domainName(emailMessagesDesc);
        let domain = domainByName[domainName];
        if (!domain) {
          domain = new Domain({ name: domainName });
          domain.setIconUrl(await DomainService.fetchIconUrl(domain));
          orm.em.persist(domain);
        } else if (!domain.iconUrl) {
          domain.setIconUrl(await DomainService.fetchIconUrl(domain));
          if (domain.iconUrl) orm.em.persist(domain);
        }
        domainByName[domain.name] = domain;

        const category = await EmailMessageService.categorizeEmailThread({
          categories: boardColumnsAsc.map((col) => col.name),
          emailMessages: emailMessagesDesc,
        });

        const boardCard = BoardCardService.buildFromEmailMessages({
          gmailAccount,
          boardColumn: boardColumnsAsc.find((col) => col.name === category) || boardColumnsAsc[0]!,
          emailMessagesDesc,
          domain,
        });
        orm.em.persist(boardCard);
        boardCardByThreadId[threadId] = boardCard;
      }
    }

    // Handle delete: delete EmailMessages, update/delete BoardCards
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

    gmailAccount.setExternalHistoryId(lastExternalHistoryId!);
    orm.em.persist(gmailAccount);

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
    if (gmailAccount.externalHistoryId) {
      console.log(`[GMAIL] Fetching ${gmailAccount.email} history since ${gmailAccount.externalHistoryId}...`);
      let pageToken: string | undefined;
      do {
        const historyResponse = await gmail.users.history.list({
          userId: 'me',
          startHistoryId: gmailAccount.externalHistoryId,
          historyTypes: ['messageAdded', 'messageDeleted', 'labelAdded', 'labelRemoved'],
          pageToken,
        });

        for (const history of historyResponse.data.history || []) {
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
        pageToken = historyResponse.data.nextPageToken || undefined;
        if (historyResponse.data.historyId) {
          gmailAccount.setExternalHistoryId(historyResponse.data.historyId); // Increasing historyId when paginating
        }
      } while (pageToken);
    } else {
      console.log(`[GMAIL] Fetching ${gmailAccount.email} initial emails...`);
      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        maxResults: CREATE_EMAIL_MESSAGES_BATCH_LIMIT,
        includeSpamTrash: true,
      });

      const messages = listResponse.data.messages || [];
      externalEmailMessageIdsToAdd.push(...messages.map((m) => m.id).filter((id): id is string => !!id));
    }

    return {
      lastExternalHistoryId: gmailAccount.externalHistoryId,
      externalEmailMessageIdsToAdd: unique(externalEmailMessageIdsToAdd),
      externalEmailMessageIdsToDelete: unique(externalEmailMessageIdsToDelete),
      labelChanges,
    };
  }

  private static async findDomainByName(emailMessagesDescByThreadId: Record<string, EmailMessage[]>) {
    const domainNames: string[] = [];
    for (const [_, emailMessagesDesc] of Object.entries(emailMessagesDescByThreadId)) {
      domainNames.push(EmailMessageService.domainName(emailMessagesDesc));
    }

    return DomainService.findDomainByName(unique(domainNames));
  }

  private static domainName(emailMessagesDesc: EmailMessage[]) {
    if (emailMessagesDesc.length === 0) {
      throw new Error('Cannot determine domain name from empty email messages');
    }
    const firstEmailMessage = emailMessagesDesc[emailMessagesDesc.length - 1]!;

    if (firstEmailMessage.sent) {
      [
        ...(firstEmailMessage.to?.map((p) => p.email.split('@')[1]) || []),
        ...(firstEmailMessage.cc?.map((p) => p.email.split('@')[1]) || []),
        ...(firstEmailMessage.bcc?.map((p) => p.email.split('@')[1]) || []),
      ].find((domainName): domainName is string => !!domainName)!;
    }

    return [
      firstEmailMessage.from.email.split('@')[1],
      firstEmailMessage.replyTo?.email.split('@')[1],
      ...(firstEmailMessage.cc?.map((p) => p.email.split('@')[1]) || []),
      ...(firstEmailMessage.bcc?.map((p) => p.email.split('@')[1]) || []),
    ].find((domainName): domainName is string => !!domainName)!;
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

    const toEmails = GoogleApi.gmailHeaderValue(headers, 'to')
      ?.split(',')
      .map((e) => e.trim());
    const ccEmails = GoogleApi.gmailHeaderValue(headers, 'cc')
      ?.split(',')
      .map((e) => e.trim());
    const bccEmails = GoogleApi.gmailHeaderValue(headers, 'bcc')
      ?.split(',')
      .map((e) => e.trim());
    const { bodyText, bodyHtml } = GoogleApi.gmailBody(messageData.payload);

    // Gmail sometimes returns future dates
    const parsedInternalDate = new Date(parseInt(messageData.internalDate as string, 10));
    const now = new Date();

    const emailMessage = new EmailMessage({
      gmailAccount,
      externalId: messageData.id as string,
      externalThreadId: messageData.threadId as string,
      externalCreatedAt: parsedInternalDate > now ? now : parsedInternalDate,
      from: EmailMessageService.parseParticipant(GoogleApi.gmailHeaderValue(headers, 'from'))!,
      subject: GoogleApi.gmailHeaderValue(headers, 'subject') as string,
      snippet: cheerio.load(messageData.snippet!).text(),
      sent: labels.includes(LABEL.SENT),
      labels,
      to: presence(toEmails?.map(EmailMessageService.parseParticipant).filter((p): p is Participant => !!p)),
      replyTo: EmailMessageService.parseParticipant(GoogleApi.gmailHeaderValue(headers, 'reply-to')),
      cc: presence(ccEmails?.map(EmailMessageService.parseParticipant).filter((p): p is Participant => !!p)),
      bcc: presence(bccEmails?.map(EmailMessageService.parseParticipant).filter((p): p is Participant => !!p)),
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
      });
      attachments.push(attachment);
    }

    return { emailMessage, attachments };
  }

  private static parseParticipant(emailAddress?: string) {
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
}
