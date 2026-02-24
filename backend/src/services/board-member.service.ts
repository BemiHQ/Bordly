import type { AutoPath, Loaded, Populate, PopulatePath } from '@mikro-orm/postgresql';
import type { Board } from '@/entities/board';
import { BoardCard } from '@/entities/board-card';
import { BoardMember, BoardMemberMemory, type Role } from '@/entities/board-member';
import { EmailMessage } from '@/entities/email-message';
import type { User } from '@/entities/user';
import { AgentService } from '@/services/agent.service';
import { parseTextBody } from '@/utils/email';
import { reportError } from '@/utils/error-tracking';
import { orm } from '@/utils/orm';
import { MemoryFormality } from '@/utils/shared';

const AGENT_MEMORY_ANALYSIS = {
  name: 'Board Member Memory Analysis Agent',
  instructions: `Analyze the following sent email messages to extract the sender's communication patterns and preferences.

Extract and return ONLY a valid JSON object with these fields (set to null if not found):
- greeting: Common greeting pattern (e.g., "Hi [First Name],", "Hello [Full Name],", "Hey,")
- opener: Common opening line after greeting (e.g., "Hope you're doing well!", "Thanks for reaching out.")
- signature: Email signature style (e.g., "Best,\nJohn", "Cheers,\nJohn Smith\nCEO", "Thank you,\nJohn")
- formality: Level of formality (${Object.values(MemoryFormality).join(', ')})
- meetingLink: Common meeting link if present (e.g., Calendly/Cal.com link)`,
};

const MAX_EMAILS_CONTENT_LENGTH_TO_ANALYZE = 1_000_000; // 1 million characters = ~250K tokens

export class BoardMemberService {
  static async populate<Hint extends string = never>(
    boardMember: BoardMember,
    populate: readonly AutoPath<BoardMember, Hint, PopulatePath.ALL>[],
  ) {
    await orm.em.populate(boardMember, populate);
    return boardMember;
  }

  static async findMembers<Hint extends string = never>(
    board: Board,
    { populate }: { populate?: Populate<BoardMember, Hint> } = {},
  ) {
    return orm.em.find(BoardMember, { board }, { populate });
  }

  static async setRole(board: Board, { userId, role, currentUser }: { userId: string; role: Role; currentUser: User }) {
    if (currentUser.id === userId) throw new Error('Cannot change your own role');

    const boardMember = await BoardMemberService.findByUserId(board, { userId, populate: ['assignedBoardCards'] });

    boardMember.setRole(role);
    orm.em.persist(boardMember);

    for (const boardCard of boardMember.assignedBoardCards) {
      boardCard.assignedBoardMember = undefined;
      orm.em.persist(boardCard);
    }

    await orm.em.flush();

    return boardMember;
  }

  static async delete(board: Board, { userId, currentUser }: { userId: string; currentUser: User }) {
    if (currentUser.id === userId) throw new Error('Cannot remove yourself from the board');

    const boardMember = await BoardMemberService.findByUserId(board, { userId });

    await orm.em.transactional(async (em) => {
      await em.nativeUpdate(BoardCard, { assignedBoardMember: boardMember }, { assignedBoardMember: null });
      await em.nativeDelete(BoardMember, { id: boardMember.id });
    });
  }

  static async findById<Hint extends string = never>(
    board: Loaded<Board>,
    { boardMemberId, populate = [] }: { boardMemberId: string; populate?: Populate<BoardMember, Hint> },
  ) {
    return orm.em.findOneOrFail(BoardMember, { board, id: boardMemberId }, { populate });
  }

  static async findByUserId<Hint extends string = never>(
    board: Board,
    { userId, populate = [] }: { userId: string; populate?: Populate<BoardMember, Hint> },
  ) {
    return orm.em.findOneOrFail(BoardMember, { board, user: userId }, { populate });
  }

  static async setMemory(
    boardMember: Loaded<BoardMember, 'user'>,
    { greeting, opener, signature, formality, meetingLink }: Partial<BoardMemberMemory>,
  ) {
    if (boardMember.isAgent) throw new Error('Cannot set memory for agent board member');

    const memory = new BoardMemberMemory();
    if (greeting) memory.greeting = greeting;
    if (opener) memory.opener = opener;
    if (signature) memory.signature = signature;
    if (formality) memory.formality = formality;
    if (meetingLink) memory.meetingLink = meetingLink;

    boardMember.setMemory(memory);
    orm.em.persist(boardMember);
    await orm.em.flush();

    return boardMember;
  }

  static async setInitialMemory(boardMember: Loaded<BoardMember, 'user'>) {
    if (boardMember.isAgent) throw new Error('Cannot set memory for agent board member');

    const boardCards = await orm.em.find(BoardCard, {
      boardColumn: { board: boardMember.board },
      participantUserIds: { $contains: [boardMember.user.id] },
    });

    if (boardCards.length === 0) return;

    const externalThreadIds = boardCards.map((card) => card.externalThreadId).filter((id): id is string => !!id);
    if (externalThreadIds.length === 0) return;

    const emailMessages = await orm.em.find(
      EmailMessage,
      { externalThreadId: { $in: externalThreadIds }, gmailAccount: boardMember.loadedUser.gmailAccount, sent: true },
      { orderBy: { externalCreatedAt: 'DESC' } },
    );
    if (emailMessages.length === 0) return;

    const agent = AgentService.createAgent(AGENT_MEMORY_ANALYSIS);

    let totalContentLength = 0;
    const emailContents: string[] = [];
    for (const msg of emailMessages) {
      const { mainText } = parseTextBody(msg.bodyText || '');
      const content = `From: ${msg.from.email}
Subject: ${msg.subject}
Body: ${mainText}`;

      totalContentLength += content.length;
      if (totalContentLength > MAX_EMAILS_CONTENT_LENGTH_TO_ANALYZE) break;

      emailContents.push(content);
    }

    console.log(`[AGENT] Analyzing ${emailMessages.length} sent messages for board member memory...`);
    const response = await agent.generate([
      { role: 'user', content: `Analyze these sent emails: ${emailContents.join('\n\n---\n\n')}` },
    ]);

    let memoryData: Partial<BoardMemberMemory>;
    try {
      const cleanedResponse = response.text.replace(/```json\n?|\n?```/g, '').trim();
      memoryData = JSON.parse(cleanedResponse);
    } catch (error) {
      reportError(error, { email: boardMember.user.email });
      return;
    }

    const memory = new BoardMemberMemory();
    if (memoryData.greeting) memory.greeting = memoryData.greeting;
    if (memoryData.opener) memory.opener = memoryData.opener;
    if (memoryData.signature) memory.signature = memoryData.signature;
    if (memoryData.formality) memory.formality = memoryData.formality;
    if (memoryData.meetingLink) memory.meetingLink = memoryData.meetingLink;

    boardMember.setMemory(memory);
    orm.em.persist(boardMember);
    await orm.em.flush();
  }
}
