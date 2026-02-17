import type { Agent } from '@mastra/core/agent';
import * as cheerio from 'cheerio';
import type { gmail_v1 } from 'googleapis/build/src/apis/gmail/v1';

import { Attachment } from '@/entities/attachment';
import { BoardCard, State } from '@/entities/board-card';
import { BoardColumn, SPAM_POSITION, TRASH_POSITION } from '@/entities/board-column';
import { EmailMessage, LABELS, type Participant } from '@/entities/email-message';
import type { GmailAccount } from '@/entities/gmail-account';
import { AgentService } from '@/services/agent.service';
import { BoardCardService } from '@/services/board-card.service';
import { DomainService } from '@/services/domain.service';
import { GmailAccountService } from '@/services/gmail-account.service';
import { gmailAttachmentsData, gmailBody, gmailHeaderValue, newGmail } from '@/utils/google-api';
import { orm } from '@/utils/orm';
import { renderTemplate } from '@/utils/strings';
import { sleep } from '@/utils/time';

const CREATE_INITIAL_EMAIL_MESSAGES_LIMIT = 50;
const OVERLAP_EMAIL_MESSAGES_MS = 1 * 60 * 1_000; // 1 minute
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
  OTHERS: 'Others',
  // Special categories
  SPAM: 'Spam',
  TRASH: 'Trash',
};

const AGENT_CATEGORIZATION = {
  name: 'Email Thread Categorization Agent',
  instructionsTemplate: `Categorize the email thread from the following categories based on its content:
- {{categories}}

Only output one of the above categories without any explanation.`,
};

export class EmailMessageService {
  static async loopCreateNewEmailMessages() {
    const lastExistingEmailMessageByGmailAccountId: Record<string, EmailMessage | null> = {};

    while (true) {
      const gmailAccounts = await GmailAccountService.findAllAccounts({ populate: ['board.boardColumns'] });

      for (const gmailAccount of gmailAccounts) {
        if (!gmailAccount.board?.initialized) {
          console.log(`[GMAIL] Skipping ${gmailAccount.email} new emails fetch as board is not initialized.`);
          continue;
        }

        const { oauth2Client } = await GmailAccountService.refreshAccessToken(gmailAccount);
        const gmail = newGmail(oauth2Client);

        const lastExistingEmailMessage =
          lastExistingEmailMessageByGmailAccountId[gmailAccount.id] ||
          (await orm.em.findOne(EmailMessage, { gmailAccount }, { orderBy: { externalCreatedAt: 'DESC' } }));

        const query = lastExistingEmailMessage
          ? `after:${Math.floor((lastExistingEmailMessage.externalCreatedAt.getTime() - OVERLAP_EMAIL_MESSAGES_MS) / 1000)}`
          : undefined;

        const emailMessagesDescByThreadId: Record<string, EmailMessage[]> = {};
        let pageToken: string | undefined;
        let foundPreviousMessage = false;

        // Create EmailMessages and Attachments
        do {
          console.log(
            `[GMAIL] Fetching ${gmailAccount.email} new emails${query ? ` with "${query}"` : ''}${pageToken ? ' (via pageToken)' : ''}...`,
          );
          const listResponse = await gmail.users.messages.list({
            userId: 'me',
            q: query,
            maxResults: CREATE_INITIAL_EMAIL_MESSAGES_LIMIT,
            includeSpamTrash: true,
            pageToken,
          });

          let messages = listResponse.data.messages || [];
          if (messages.length === 0) break;

          if (lastExistingEmailMessage && !foundPreviousMessage) {
            messages = messages.filter((message) => {
              if (message.id === lastExistingEmailMessage!.externalId) {
                foundPreviousMessage = true;
                return false;
              }
              return !foundPreviousMessage; // Exclude messages after the last known message
            });
          }

          for (const message of messages) {
            if (!message.id) continue;

            console.log(`[GMAIL] Fetching ${gmailAccount.email} message ${message.id}...`);
            const messageDetails = await gmail.users.messages.get({ userId: 'me', id: message.id, format: 'full' });
            const { emailMessage, attachments } = EmailMessageService.parseEmailMessage({
              gmailAccount,
              messageData: messageDetails.data,
            });
            orm.em.persist([emailMessage, ...attachments]);
            (emailMessagesDescByThreadId[emailMessage.externalThreadId] ??= []).push(emailMessage);
          }

          pageToken = listResponse.data.nextPageToken || undefined;

          if (foundPreviousMessage) break; // Stop pagination if we found the previous message
        } while (pageToken);

        // Update or Create BoardCards
        const boardColumnsAsc = gmailAccount.board.boardColumns.getItems().sort((a, b) => a.position - b.position);
        for (const [threadId, emailMessagesDesc] of Object.entries(emailMessagesDescByThreadId)) {
          let boardCard = await BoardCardService.tryFindByGmailAccountAndExternalThreadId({
            gmailAccount,
            externalThreadId: threadId,
          });

          const state = EmailMessageService.boardCardStateFromEmailMessages(emailMessagesDesc);
          const participants = EmailMessageService.uniqueParticipantsAsc([
            ...(boardCard?.participants || []),
            ...EmailMessageService.participantsAsc({ emailMessagesDesc, gmailAccount }),
          ]);
          const unreadEmailMessageIds = [
            ...(boardCard?.unreadEmailMessageIds || []),
            ...EmailMessageService.unreadEmailMessageIds(emailMessagesDesc),
          ];
          const firstEmailMessage = emailMessagesDesc[emailMessagesDesc.length - 1]!;
          const lastEmailMessage = emailMessagesDesc[0]!;

          if (boardCard) {
            boardCard.update({
              state,
              snippet: lastEmailMessage.snippet,
              participants,
              lastEventAt: lastEmailMessage.externalCreatedAt,
              unreadEmailMessageIds: unreadEmailMessageIds.length > 0 ? unreadEmailMessageIds : undefined,
              movedToTrashAt: state === State.TRASHED ? new Date() : boardCard.movedToTrashAt,
            });
            console.log(`[GMAIL] Updated board card for thread ${threadId}`);
          } else {
            const agent = AgentService.createAgent({
              name: AGENT_CATEGORIZATION.name,
              instructions: renderTemplate(AGENT_CATEGORIZATION.instructionsTemplate, {
                categories: boardColumnsAsc.map((col) => col.name).join('\n- '),
              }),
            });
            const category = await EmailMessageService.categorizeEmailThread({
              agent,
              emailMessages: emailMessagesDesc,
            });
            let boardColumn = boardColumnsAsc.find((col) => col.name === category);
            if (!boardColumn) {
              console.warn(
                `[GMAIL] No board column found "${category}", using first column ${boardColumnsAsc[0]!.name}`,
              );
              boardColumn = boardColumnsAsc[0]!;
            }
            const domain = await DomainService.findOrInitDomainWithIcon(
              EmailMessageService.domainName(emailMessagesDesc),
            );
            boardCard = new BoardCard({
              gmailAccount,
              boardColumn: boardColumn!,
              domain,
              externalThreadId: threadId,
              state,
              subject: firstEmailMessage.subject,
              snippet: lastEmailMessage.snippet,
              participants,
              lastEventAt: lastEmailMessage.externalCreatedAt,
              unreadEmailMessageIds: unreadEmailMessageIds.length > 0 ? unreadEmailMessageIds : undefined,
              movedToTrashAt: state === State.TRASHED ? new Date() : undefined,
            });
            console.log(`[GMAIL] Created board card for thread ${threadId} in column ${boardColumn!.name}`);
          }

          orm.em.persist(boardCard);
        }

        await orm.em.flush();
        console.log(`[GMAIL] Finished fetching emails for ${gmailAccount.email}`);

        if (Object.keys(emailMessagesDescByThreadId).length > 0) {
          lastExistingEmailMessageByGmailAccountId[gmailAccount.id] = await orm.em.findOne(
            EmailMessage,
            { gmailAccount },
            { orderBy: { externalCreatedAt: 'DESC' } },
          );
        }
      }

      await sleep(CREATE_NEW_EMAIL_MESSAGES_INTERVAL_MS);
    }
  }

  static async createInitialEmailMessages(gmailAccountId: string) {
    const gmailAccount = await GmailAccountService.findById(gmailAccountId, { populate: ['board'] });
    if (!gmailAccount.board) throw new Error('Gmail account does not have an associated board');

    const { oauth2Client } = await GmailAccountService.refreshAccessToken(gmailAccount);
    const gmail = newGmail(oauth2Client);

    console.log(`[GMAIL] Fetching ${gmailAccount.email} initial emails in desc order...`);
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      maxResults: CREATE_INITIAL_EMAIL_MESSAGES_LIMIT,
      includeSpamTrash: true,
    });
    const messages = listResponse.data.messages || [];
    if (messages.length === 0) return;

    // Create EmailMessages and Attachments
    const emailMessagesDescByThreadId: Record<string, EmailMessage[]> = {};
    for (const message of messages) {
      if (!message.id) continue;

      console.log(`[GMAIL] Fetching ${gmailAccount.email} message ${message.id}...`);
      const messageDetails = await gmail.users.messages.get({ userId: 'me', id: message.id, format: 'full' });
      const { emailMessage, attachments } = EmailMessageService.parseEmailMessage({
        gmailAccount,
        messageData: messageDetails.data,
      });
      orm.em.persist([emailMessage, ...attachments]);
      (emailMessagesDescByThreadId[emailMessage.externalThreadId] ??= []).push(emailMessage);
    }

    // Categorize email threads
    const agent = AgentService.createAgent({
      name: AGENT_CATEGORIZATION.name,
      instructions: renderTemplate(AGENT_CATEGORIZATION.instructionsTemplate, {
        categories: Object.values(CATEGORIES)
          .filter((category) => category !== CATEGORIES.SPAM && category !== CATEGORIES.TRASH)
          .join('\n- '),
      }),
    });
    const emailThreadIdsByCategory: Record<string, string[]> = {};
    for (const [threadId, emailMessages] of Object.entries(emailMessagesDescByThreadId)) {
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
        const emailMessagesDesc = emailMessagesDescByThreadId[threadId]!;
        const state = EmailMessageService.boardCardStateFromEmailMessages(emailMessagesDesc);
        const participants = EmailMessageService.uniqueParticipantsAsc(
          EmailMessageService.participantsAsc({ emailMessagesDesc, gmailAccount }),
        );
        const unreadEmailMessageIds = EmailMessageService.unreadEmailMessageIds(emailMessagesDesc);
        const domain = await DomainService.findOrInitDomainWithIcon(EmailMessageService.domainName(emailMessagesDesc));
        const lastEmailMessage = emailMessagesDesc[0]!;
        const firstEmailMessage = emailMessagesDesc[emailMessagesDesc.length - 1]!;

        const boardCard = new BoardCard({
          gmailAccount,
          boardColumn: boardColumnsByCategory[category]!,
          domain,
          externalThreadId: threadId,
          state,
          subject: firstEmailMessage.subject,
          snippet: lastEmailMessage.snippet,
          participants,
          lastEventAt: lastEmailMessage.externalCreatedAt,
          unreadEmailMessageIds: unreadEmailMessageIds.length > 0 ? unreadEmailMessageIds : undefined,
          movedToTrashAt: state === State.TRASHED ? new Date() : undefined,
        });
        orm.em.persist([domain, boardCard]);
      }
    }

    await orm.em.flush();
  }

  // -------------------------------------------------------------------------------------------------------------------

  private static participantsAsc({
    emailMessagesDesc,
    gmailAccount,
  }: {
    emailMessagesDesc: EmailMessage[];
    gmailAccount: GmailAccount;
  }) {
    return emailMessagesDesc
      .reverse()
      .flatMap((msg) =>
        msg.sent
          ? [...(msg.to || []), ...(msg.cc || []), ...(msg.bcc || [])]
          : [msg.from, ...(msg.to || []), ...(msg.cc || [])],
      )
      .filter((p) => p.email !== gmailAccount.email);
  }

  // Make unique by email, preferring participants with names
  private static uniqueParticipantsAsc(participantsAsc: Participant[]) {
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

  private static boardCardStateFromEmailMessages(emailMessages: EmailMessage[]) {
    if (emailMessages.every((msg) => msg.labels.includes(LABELS.SPAM))) {
      return State.SPAM;
    } else if (emailMessages.every((msg) => msg.labels.includes(LABELS.TRASH))) {
      return State.TRASHED;
    }
    return State.INBOX;
  }

  private static unreadEmailMessageIds(emailMessages: EmailMessage[]) {
    return emailMessages.filter((msg) => msg.labels.includes(LABELS.UNREAD)).map((msg) => msg.id);
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
    const labels = messageData.labelIds || [];
    const headers = messageData.payload?.headers || [];
    const toEmails = gmailHeaderValue(headers, 'to')
      ?.split(',')
      .map((e) => e.trim());
    const ccEmails = gmailHeaderValue(headers, 'cc')
      ?.split(',')
      .map((e) => e.trim());
    const bccEmails = gmailHeaderValue(headers, 'bcc')
      ?.split(',')
      .map((e) => e.trim());
    const { bodyText, bodyHtml } = gmailBody(messageData.payload);

    // Gmail sometimes returns future dates
    const parsedInternalDate = new Date(parseInt(messageData.internalDate as string, 10));
    const now = new Date();

    const emailMessage = new EmailMessage({
      gmailAccount,
      externalId: messageData.id as string,
      externalThreadId: messageData.threadId as string,
      externalCreatedAt: parsedInternalDate > now ? now : parsedInternalDate,
      from: EmailMessageService.parseParticipant(gmailHeaderValue(headers, 'from'))!,
      subject: gmailHeaderValue(headers, 'subject') as string,
      snippet: cheerio.load(messageData.snippet!).text(),
      sent: labels.includes(LABELS.SENT),
      labels,
      to: toEmails?.map(EmailMessageService.parseParticipant).filter((p): p is Participant => !!p),
      replyTo: EmailMessageService.parseParticipant(gmailHeaderValue(headers, 'reply-to')),
      cc: ccEmails?.map(EmailMessageService.parseParticipant).filter((p): p is Participant => !!p),
      bcc: bccEmails?.map(EmailMessageService.parseParticipant).filter((p): p is Participant => !!p),
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
