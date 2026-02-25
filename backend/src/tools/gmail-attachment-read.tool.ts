import type { MessageListInput } from '@mastra/core/agent/message-list';
import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { GmailAttachment } from '@/entities/gmail-attachment';
import type { Context } from '@/services/agent.service';
import { AgentService } from '@/services/agent.service';
import { GmailAttachmentService } from '@/services/gmail-attachment.service';
import { ENV } from '@/utils/env';
import { Logger } from '@/utils/logger';

const AGENT = {
  name: 'Gmail Attachment Analyzer',
  instructions: `You are an AI assistant that analyzes Gmail attachments.
Provide:
- pageCount: Number of pages (if applicable, otherwise 1)
- text: The extracted text content of the attachment. If there are more than 3 pages, provide a summary instead of the full text.
- language: The primary language of the content (e.g., "English", "Spanish", etc.)
`,
  model: ENV.LLM_FAST_MODEL,
};

export const gmailAttachmentReadTool = createTool({
  id: 'gmail-attachment-read',
  description: 'Read and analyze Gmail attachment content including text, page count, and language',
  inputSchema: z.object({
    id: z.string().describe('Gmail attachment ID'),
  }),
  execute: async ({ id }, context) => {
    const { requestContext } = context as { requestContext: RequestContext<Context> };
    const boardCard = requestContext.get('boardCard');
    Logger.info(`[AGENT] Tool gmail-attachment-read for attachment ${id}`);

    const { externalThreadId } = boardCard;
    if (!externalThreadId) throw new Error('Board card does not have an external thread ID');
    const gmailAttachment = await GmailAttachmentService.findByIdAndExternalThreadId(id, {
      externalThreadId,
      populate: ['emailMessage.gmailAccount'],
    });

    const agent = AgentService.createAgent(AGENT);

    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: `Analyze this Gmail attachment: ${GmailAttachment.toStr(gmailAttachment)}` },
          {
            type: 'file',
            filename: gmailAttachment.filename,
            mimeType: gmailAttachment.derivedMimeType,
            size: gmailAttachment.size,
            data: await GmailAttachmentService.getAttachmentDataBuffer(gmailAttachment),
          },
        ],
      },
    ] as MessageListInput;

    const { object } = await agent.generate(messages, {
      structuredOutput: {
        schema: z.object({
          text: z.string(),
          pageCount: z.number().int().nonnegative(),
          language: z.string(),
        }),
      },
    });

    const result = {
      text: object.text,
      language: object.language,
      pageCount: object.pageCount,
      filename: gmailAttachment.filename,
      mimeType: gmailAttachment.derivedMimeType,
      size: gmailAttachment.size,
    };

    Logger.logObject(result);
    return result;
  },
});
