import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { Context } from '@/services/agent.service';
import { AgentService } from '@/services/agent.service';
import { GmailAttachmentService } from '@/services/gmail-attachment.service';
import { ENV } from '@/utils/env';
import { Logger } from '@/utils/logger';

const AGENT = {
  name: 'Gmail Attachment Analyzer',
  instructions: `You are an AI assistant that analyzes a Gmail attachment.
For large attachments with more than 2 pages, do not attempt to extract the entire content. Instead, provide a summary of the content and key insights.
`,
  model: ENV.LLM_FAST_MODEL,
};

export const gmailAttachmentAnalyzeTool = createTool({
  id: 'gmail-attachment-analyze',
  description: 'Analyze Gmail attachment content',
  inputSchema: z.object({
    id: z.string().describe('Gmail attachment ID'),
    prompt: z.string().describe('Prompt to guide the analysis'),
  }),
  execute: async ({ id, prompt }, context) => {
    const { requestContext } = context as { requestContext: RequestContext<Context> };
    const boardCard = requestContext.get('boardCard');
    Logger.info(`[AGENT] Tool gmail-attachment-analyze for attachment ${id}:\nPrompt: ${prompt}`);

    const { externalThreadId } = boardCard;
    if (!externalThreadId) throw new Error('Board card does not have an external thread ID');
    const gmailAttachment = await GmailAttachmentService.findByIdAndExternalThreadId(id, {
      externalThreadId,
      populate: ['emailMessage.gmailAccount'],
    });

    const agent = AgentService.createAgent(AGENT);

    const response = await agent.generate([
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'file',
            filename: gmailAttachment.filename,
            mediaType: gmailAttachment.derivedMimeType,
            data: await GmailAttachmentService.getAttachmentDataBuffer(gmailAttachment),
          },
        ],
      },
    ]);

    const result = {
      output: response.text,
      filename: gmailAttachment.filename,
      mimeType: gmailAttachment.derivedMimeType,
      size: gmailAttachment.size,
    };

    Logger.debugObject(result);
    Logger.info(`[AGENT] Completed tool gmail-attachment-analyze for attachment ${id}`);
    return result;
  },
});
