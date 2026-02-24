import { Agent } from '@mastra/core/agent';
import type { MessageListInput } from '@mastra/core/agent/message-list';
import { RequestContext } from '@mastra/core/request-context';
import type { ToolAction } from '@mastra/core/tools';
import type { Loaded } from '@mikro-orm/postgresql';
import type { Board } from '@/entities/board';
import { BoardMember } from '@/entities/board-member';
import { BORDLY_USER_ID } from '@/entities/user';
import { BoardMemberService } from '@/services/board-member.service';
import { boardCardReadTool } from '@/tools/board-card-read.tool';
import { emailDraftUpsertTool } from '@/tools/email-draft-upsert.tool';
import { ENV } from '@/utils/env';
import { slugify } from '@/utils/strings';

export interface Context {
  userBoardMember?: Loaded<BoardMember>;
  userTimeZone?: string;
  bordlyBoardMember: Loaded<BoardMember>;
}

const BORDLY_AGENT = {
  name: 'Bordly',
  instructions: `You are an AI email assistant called Bordly that helps manage email communications within a Trello-like board card using the provided tools.

# General guidelines

- Treat the user's prompt as a simplified request, not a word-for-word instruction.
- Never make assumptions about the board card's state without using the tools to verify.

# Writing emails

- Prioritize board member preferences in your responses if they exist (greeting, opener, signature, formality, meeting link).
- When generating HTML email content, add empty lines (\`<p></p>\`) between paragraphs.
`,
  model: ENV.LLM_THINKING_MODEL,
  tools: {
    'board-card-read': boardCardReadTool,
    'email-draft-upsert': emailDraftUpsertTool,
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
    boardCardId,
    prompt,
    userBoardMember,
    userTimeZone,
  }: {
    board: Loaded<Board>;
    boardCardId: string;
    prompt: string;
    userBoardMember: Loaded<BoardMember, 'user' | 'memory'>;
    userTimeZone?: string;
  }) {
    const bordlyBoardMember = await BoardMemberService.findByUserId(board, { userId: BORDLY_USER_ID });
    if (!bordlyBoardMember.isAgent) {
      throw new Error('Only board members with agent permissions can run agents');
    }

    const requestContext = new RequestContext<Context>() as unknown as RequestContext;
    requestContext.set('bordlyBoardMember', bordlyBoardMember);
    requestContext.set('userBoardMember', userBoardMember);
    requestContext.set('userTimeZone', userTimeZone);

    const agent = AgentService.createAgent(BORDLY_AGENT);
    const messages: MessageListInput = [
      { role: 'system', content: `You are assisting with email management for a board card with ID ${boardCardId}.` },
      { role: 'system', content: `The user who sent the prompt: ${BoardMember.toText(userBoardMember)}` },
      { role: 'user', content: prompt },
    ];

    console.log(`[AGENT] Running Bordly for board card ${boardCardId}: ${JSON.stringify(messages)}`);
    const response = await agent.generate(messages, { requestContext });
    console.log(`[AGENT] Bordly completed for board card ${boardCardId}: ${response.text}`);

    return response;
  }
}
