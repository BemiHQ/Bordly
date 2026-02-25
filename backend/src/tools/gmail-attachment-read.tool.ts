import type { MessageListInput } from '@mastra/core/agent/message-list';
import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import type { Loaded } from '@mikro-orm/postgresql';
import { z } from 'zod';
import { GmailAttachment } from '@/entities/gmail-attachment';
import type { Context } from '@/services/agent.service';
import { AgentService } from '@/services/agent.service';
import { GmailAttachmentService } from '@/services/gmail-attachment.service';
import { ENV } from '@/utils/env';
import { Logger } from '@/utils/logger';

const MIME_TYPE_BY_FILE_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  txt: 'text/plain',
  csv: 'text/csv',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function mimeType(gmailAttachment: Loaded<GmailAttachment>) {
  if (gmailAttachment.mimeType === 'application/octet-stream') {
    const ext = gmailAttachment.filename.toLowerCase().split('.').pop();
    if (ext && MIME_TYPE_BY_FILE_EXTENSION[ext]) {
      return MIME_TYPE_BY_FILE_EXTENSION[ext];
    }
    throw new Error(`Unknown MIME type for attachment ${gmailAttachment.id} (${gmailAttachment.mimeType})`);
  }
  return gmailAttachment.mimeType;
}

const AGENT = {
  name: 'Gmail Attachment Analyzer',
  instructions: `You are an AI assistant that analyzes Gmail attachments.
Extract and provide:
- text: The text content of the attachment
- language: The primary language of the content (e.g., "English", "Spanish", etc.)
- pageCount: Number of pages (if applicable, otherwise 1)
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
            mimeType: mimeType(gmailAttachment),
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
      mimeType: gmailAttachment.mimeType,
      size: gmailAttachment.size,
    };

    Logger.logObject(result);
    return result;
  },
});
