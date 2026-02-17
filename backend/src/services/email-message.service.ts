import type { Agent } from '@mastra/core/agent';
import type { gmail_v1 } from 'googleapis/build/src/apis/gmail/v1';

import { Attachment } from '@/entities/attachment';
import { BoardCard } from '@/entities/board-card';
import { BoardColumn, SPAM_POSITION, TRASH_POSITION } from '@/entities/board-column';
import { EmailMessage } from '@/entities/email-message';
import type { GmailAccount } from '@/entities/gmail-account';
import { AgentService } from '@/services/agent.service';
import { GmailAccountService } from '@/services/gmail-account.service';
import { gmailAttachmentsData, gmailBody, gmailHeaderValue, newGmail } from '@/utils/google-api';
import { orm } from '@/utils/orm';

const CREATE_INITIAL_EMAILS_LIMIT = 50;
const MAX_INITIAL_BOARD_COUNT = 5;

const LABELS = {
  SPAM: 'SPAM',
  TRASH: 'TRASH',
};

const CATEGORIES = {
  CUSTOMERS: 'Customers',
  ENGINEERING: 'Engineering',
  FINANCE: 'Finance',
  MEETINGS: 'Meetings',
  PROMOTIONS: 'Promotions',
  SOCIAL: 'Social',
  OTHERS: 'Others',
  // Special categories
  SPAM: 'Spam',
  TRASH: 'Trash',
};

const AGENT_CATEGORIZATION = {
  name: 'Email Thread Categorization Agent',
  instructions: `Categorize the email thread from the following categories based on its content:
- ${Object.values(CATEGORIES)
    .filter((category) => category !== CATEGORIES.SPAM && category !== CATEGORIES.TRASH)
    .join('\n- ')}

Only output one of the above categories without any explanation.`,
};

export class EmailMessageService {
  static async findMessagesByThreadId({
    gmailAccounts,
    threadIds,
  }: {
    gmailAccounts: GmailAccount[];
    threadIds: string[];
  }) {
    if (threadIds.length === 0) return [];
    const emailMessages = await orm.em.find(EmailMessage, {
      gmailAccount: { $in: gmailAccounts.map((account) => account) },
      externalThreadId: { $in: threadIds },
    });

    const emailMessagesByThreadId: Record<string, EmailMessage[]> = {};
    for (const emailMessage of emailMessages) {
      (emailMessagesByThreadId[emailMessage.externalThreadId] ??= []).push(emailMessage);
    }
    return emailMessagesByThreadId;
  }

  static async createInitialEmailMessages(gmailAccountId: string) {
    const gmailAccount = await GmailAccountService.findById(gmailAccountId, { populate: ['board'] });
    if (!gmailAccount.board) throw new Error('Gmail account does not have an associated board');

    const { oauth2Client } = await GmailAccountService.refreshAccessToken(gmailAccount);
    const gmail = newGmail(oauth2Client);

    console.log(`[GMAIL] Fetching ${gmailAccount.email} initial emails in desc order...`);
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      maxResults: CREATE_INITIAL_EMAILS_LIMIT,
      includeSpamTrash: true,
    });
    const messages = listResponse.data.messages || [];
    if (messages.length === 0) return;

    // Create EmailMessages and Attachments
    const emailMessagesByThreadId: Record<string, EmailMessage[]> = {};
    for (const message of messages) {
      if (!message.id) continue;

      console.log(`[GMAIL] Fetching ${gmailAccount.email} email ${message.id}...`);
      const messageDetails = await gmail.users.messages.get({ userId: 'me', id: message.id, format: 'full' });

      const { emailMessage, attachments } = EmailMessageService.parseEmailMessage({
        gmailAccount,
        messageData: messageDetails.data,
      });
      orm.em.persist([emailMessage, ...attachments]);
      (emailMessagesByThreadId[emailMessage.externalThreadId] ??= []).push(emailMessage);
    }

    // Categorize email threads
    const agent = AgentService.createAgent(AGENT_CATEGORIZATION);
    const emailThreadIdsByCategory: Record<string, string[]> = {};
    for (const [threadId, emailMessages] of Object.entries(emailMessagesByThreadId)) {
      const category = await EmailMessageService.categorizeEmailThread({ agent, emailMessages });
      (emailThreadIdsByCategory[category] ??= []).push(threadId);
    }

    // Find top N categories by number of threads. Always append "Others" category
    const topCategories = Object.entries(emailThreadIdsByCategory)
      .filter(
        ([category]) => category !== CATEGORIES.OTHERS && category !== CATEGORIES.SPAM && category !== CATEGORIES.TRASH,
      )
      .sort((a, b) => b[1].length - a[1].length)
      .map(([category]) => category)
      .slice(0, MAX_INITIAL_BOARD_COUNT - 1);
    topCategories.push(CATEGORIES.OTHERS);

    // Create BoardColumns and BoardCards
    const boardColumnsByCategory: Record<string, BoardColumn> = {};
    for (const [initialCategory, threadIds] of Object.entries(emailThreadIdsByCategory)) {
      let category = initialCategory;
      if (!topCategories.includes(category) && category !== CATEGORIES.SPAM && category !== CATEGORIES.TRASH) {
        category = CATEGORIES.OTHERS; // Map less frequent categories to "Others"
      }

      if (!boardColumnsByCategory[category]) {
        let position = topCategories.indexOf(category);
        if (position === -1) {
          if (category === CATEGORIES.SPAM) {
            position = SPAM_POSITION;
          } else if (category === CATEGORIES.TRASH) {
            position = TRASH_POSITION;
          }
        }

        const boardColumn = new BoardColumn({
          board: gmailAccount.board,
          name: category,
          description: `Emails categorized as '${category}'`,
          position,
        });
        boardColumnsByCategory[category] = boardColumn;
        orm.em.persist(boardColumn);
      }

      for (const threadId of threadIds) {
        const boardCard = new BoardCard({
          board: gmailAccount.board!,
          boardColumn: boardColumnsByCategory[category]!,
          externalThreadId: threadId,
        });
        orm.em.persist(boardCard);
      }
    }

    await orm.em.flush();
  }

  private static async categorizeEmailThread({
    agent,
    emailMessages,
  }: {
    agent: Agent;
    emailMessages: EmailMessage[];
  }) {
    let category = 'Others';
    if (emailMessages.some((emailMessage) => emailMessage.labels.includes(LABELS.SPAM))) {
      category = CATEGORIES.SPAM;
    } else if (emailMessages.some((emailMessage) => emailMessage.labels.includes(LABELS.TRASH))) {
      category = CATEGORIES.TRASH;
    } else {
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
    const headers = messageData.payload?.headers || [];

    const to = gmailHeaderValue(headers, 'to')
      ?.split(',')
      .map((e) => e.trim());
    const cc = gmailHeaderValue(headers, 'cc')
      ?.split(',')
      .map((e) => e.trim());
    const bcc = gmailHeaderValue(headers, 'bcc')
      ?.split(',')
      .map((e) => e.trim());
    const { bodyText, bodyHtml } = gmailBody(messageData.payload);

    const emailMessage = new EmailMessage({
      gmailAccount,
      externalId: messageData.id as string,
      externalThreadId: messageData.threadId as string,
      externalCreatedAt: new Date(parseInt(messageData.internalDate as string, 10)),
      from: gmailHeaderValue(headers, 'from') as string,
      subject: gmailHeaderValue(headers, 'subject') as string,
      snippet: messageData.snippet as string,
      labels: messageData.labelIds as string[],
      to,
      replyTo: gmailHeaderValue(headers, 'reply-to'),
      cc,
      bcc,
      bodyText,
      bodyHtml,
    });

    const attachments: Attachment[] = [];

    for (const attachmentData of gmailAttachmentsData(messageData.payload)) {
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
}
