import { Agent } from '@mastra/core/agent';
import type { MessageInput } from '@mastra/core/agent/message-list';
import { RequestContext } from '@mastra/core/request-context';
import type { ToolAction } from '@mastra/core/tools';
import type { Loaded } from '@mikro-orm/postgresql';
import type { Board } from '@/entities/board';
import type { BoardCard } from '@/entities/board-card';
import { BoardMember } from '@/entities/board-member';
import type { Comment } from '@/entities/comment';
import { BORDLY_USER_ID } from '@/entities/user';
import { BoardMemberService } from '@/services/board-member.service';
import { boardCardSearchTool, buildBoardCardContext } from '@/tools/board-card-search.tool';
import { commentUpsertTool } from '@/tools/comment-upsert.tool';
import { emailDraftUpsertTool } from '@/tools/email-draft-upsert.tool';
import { gmailAttachmentAnalyzeTool } from '@/tools/gmail-attachment-analyze.tool';
import { ENV } from '@/utils/env';
import { Logger } from '@/utils/logger';
import { slugify } from '@/utils/strings';

export interface Context {
  boardCard: Loaded<
    BoardCard,
    'boardColumn' | 'assignedBoardMember.user' | 'emailDraft.fileAttachments' | 'comments.user'
  >;
  bordlyBoardMember: Loaded<BoardMember>;
  userBoardMember: Loaded<BoardMember>;
  userTimeZone?: string;
  userComment: Loaded<Comment>;
}

const AGENT_ATTACHMENT_SUMMARY = {
  name: 'Gmail Attachment Summary Agent',
  instructions: `Analyze the email attachment and provide a concise summary. The summary must be 255 characters or less.`,
  model: ENV.LLM_FAST_MODEL,
};

const AGENT_BORDLY = {
  name: 'Bordly',
  instructions: `You are an AI email assistant called Bordly that helps manage email communications within a Trello-like board card using the provided tools.

# General guidelines

- Treat the user's prompt as a simplified request, not a word-for-word instruction.
- Prefer using the board card search tool to find relevant information.

# Response guidelines

- Do not output information directly in the response.
- Use the comment tool only when the user explicitly requests information or when the email draft tool hasn't been used in the conversation.

# Writing HTML emails

- Prioritize user's preferences in your responses if they exist (greeting, opener, signature, formality, meeting link).
  - If no opener is provided, do not add it after greeting (e.g., "Hope you're doing well", "Thanks for reaching out.")
  - Include the meeting link in the email only when the conversation is about scheduling or rescheduling meetings.
- Use \`<p>\` tags for each paragraph, do not use \`<br>\` or \`\\n\` for line breaks.
- Add empty paragraphs (\`<p></p>\`) between sections with content to create spacing.
- For URLs, add \`<a>\` tags to make them clickable.
`,
  model: ENV.LLM_THINKING_MODEL,
  tools: {
    'comment-upsert': commentUpsertTool,
    'board-card-search': boardCardSearchTool,
    'email-draft-upsert': emailDraftUpsertTool,
    'gmail-attachment-analyze': gmailAttachmentAnalyzeTool,
  } as Record<string, ToolAction<unknown, unknown>>,
};

export class AgentService {
  static createAgent({
    name,
    instructions,
    model = ENV.LLM_FAST_MODEL,
    tools,
  }: {
    name: string;
    instructions: string;
    model?: string;
    tools?: Record<string, ToolAction<unknown, unknown>>;
  }) {
    const agent = new Agent({ id: slugify(name), name, instructions, model, tools });
    return agent;
  }

  static async runBordlyAgent({
    board,
    boardCard,
    userComment,
    userBoardMember,
    userTimeZone,
  }: {
    board: Loaded<Board>;
    boardCard: Loaded<BoardCard>;
    userComment: Loaded<Comment>;
    userBoardMember: Loaded<BoardMember, 'user' | 'memory'>;
    userTimeZone?: string;
  }) {
    const bordlyBoardMember = await BoardMemberService.findByUserId(board, { userId: BORDLY_USER_ID });
    if (!bordlyBoardMember.isAgent) {
      throw new Error('Only board members with agent permissions can run agents');
    }
    const { instructions: systemInstructions, boardCard: populatedBoardCard } =
      await AgentService.boardCardSystemInstructions({ boardCard, userBoardMember, userTimeZone });

    const requestContext = new RequestContext<Context>() as unknown as RequestContext;
    requestContext.set('bordlyBoardMember', bordlyBoardMember);
    requestContext.set('userBoardMember', userBoardMember);
    requestContext.set('userTimeZone', userTimeZone);
    requestContext.set('boardCard', populatedBoardCard);
    requestContext.set('userComment', userComment);

    const agent = AgentService.createAgent(AGENT_BORDLY);
    const prompt = userComment.contentText;
    const messages: MessageInput[] = [...systemInstructions, { role: 'user', content: prompt }];

    Logger.info(`[AGENT] Running Bordly for board card ${boardCard.id}\nUser prompt:\n${prompt}`);
    const response = await agent.generate(messages, { requestContext });
    Logger.info(`[AGENT] Completed Bordly for board card ${boardCard.id}:\n${response.text}`);

    return requestContext.get('boardCard') as typeof boardCard;
  }

  private static async boardCardSystemInstructions({
    boardCard: initialBoardCard,
    userBoardMember,
    userTimeZone,
  }: {
    boardCard: Loaded<BoardCard>;
    userBoardMember: Loaded<BoardMember, 'user' | 'memory'>;
    userTimeZone?: string;
  }) {
    const { boardCard, boardCardContext } = await buildBoardCardContext(initialBoardCard);
    const userLocalDateTime = new Date().toLocaleString('en-US', { timeZone: userTimeZone });

    const instructions = [
      { role: 'system', content: `Current date and time: ${userLocalDateTime} (${userTimeZone})` },
      { role: 'system', content: `The user who sent the prompt: ${BoardMember.toPrompt(userBoardMember)}` },
      { role: 'system', content: `Board card details: ${JSON.stringify(boardCardContext)}` },
    ] as MessageInput[];

    return { instructions, boardCard };
  }

  static async generateAttachmentSummary({
    data,
    filename,
    mimeType,
  }: {
    data: Buffer;
    filename: string;
    mimeType: string;
  }) {
    const agent = AgentService.createAgent(AGENT_ATTACHMENT_SUMMARY);
    console.log(`[AGENT] Generating summary for attachment ${filename}...`);

    try {
      const response = await agent.generate([
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Summarize the following email attachment' },
            { type: 'file', filename, mediaType: mimeType, data },
          ],
        },
      ]);
      return response.text.slice(0, 255);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('The document has no pages')) {
        Logger.info(`[AGENT] Failed to generate attachment summary for ${filename}: The document has no pages.`);
        return;
      } else {
        throw error;
      }
    }
  }
}
