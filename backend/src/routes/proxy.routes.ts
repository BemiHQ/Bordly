import type { FastifyInstance, FastifyRequest } from 'fastify';
import { BoardService } from '@/services/board.service';
import { BoardCardService } from '@/services/board-card.service';
import { GmailAttachmentService } from '@/services/gmail-attachment.service';
import { UserService } from '@/services/user.service';
import { ENV } from '@/utils/env';
import { reportError } from '@/utils/error-tracking';
import { ROUTES } from '@/utils/urls';

const ALLOWED_ICON_CONTENT_TYPES = [
  'image/x-icon',
  'image/png',
  'image/vnd.microsoft.icon',
  'image/jpeg',
  'image/gif',
  'image/svg+xml',
  'image/webp',
];

const REQUEST_TIMEOUT_MS = 2_000;
const MAX_ICON_SIZE = 1024 * 1024; // 1MB
const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024; // 50MB, Gmail's max attachment receiving size

const validateReferer = (request: FastifyRequest, { allowUndefined }: { allowUndefined?: boolean } = {}) => {
  const referer = request.headers.referer;
  if (referer === undefined && allowUndefined) return;

  if (!referer || !referer.startsWith(ENV.APP_ENDPOINT)) {
    throw new Error(`Unauthorized referer: ${referer}`);
  }
};

export const proxyRoutes = async (fastify: FastifyInstance) => {
  fastify.get(ROUTES.PROXY_GMAIL_ATTACHMENT, async (request, reply) => {
    const { boardId, boardCardId, gmailAttachmentId } = request.query as {
      boardId?: string;
      boardCardId?: string;
      gmailAttachmentId?: string;
    };
    if (!boardId || !boardCardId || !gmailAttachmentId) {
      return reply.status(400).send();
    }
    validateReferer(request, { allowUndefined: true });

    try {
      const userId = request.session.get('userId') as string | undefined;
      const user = await UserService.tryFindById(userId, { populate: ['boardMembers.board'] });
      if (!user) throw new Error(`User not found for ID: ${userId}`);
      const board = BoardService.tryFindAsMember(boardId, { user });
      if (!board) throw new Error(`Board not found or user is not a member: ${boardId} (user ID: ${userId})`);
      const boardCard = await BoardCardService.findById(board, { boardCardId });
      if (!boardCard.externalThreadId) {
        throw new Error(`Board card does not have an external thread ID: ${boardCardId} (user ID: ${userId})`);
      }
      const attachment = await GmailAttachmentService.findByIdAndExternalThreadId(gmailAttachmentId, {
        externalThreadId: boardCard.externalThreadId,
        populate: ['emailMessage.gmailAccount'],
      });
      if (attachment.size > MAX_ATTACHMENT_SIZE) {
        throw new Error(`Attachment size (${attachment.size} bytes) exceeds maximum limit`);
      }

      const buffer = await GmailAttachmentService.getAttachmentDataBuffer(attachment);
      const sanitizedFilename = attachment.filename.replace(/[^\w\s.-]/g, '_');

      return reply
        .header('Content-Type', attachment.mimeType)
        .header('Content-Disposition', `attachment; filename="${sanitizedFilename}"`)
        .header('Content-Length', buffer.length)
        .header('Cache-Control', 'private, max-age=86400')
        .send(buffer);
    } catch (error) {
      reportError(error);
      return reply.status(500).send({ error: 'Failed to fetch attachment' });
    }
  });

  fastify.get(ROUTES.PROXY_ICON, async (request, reply) => {
    const { url } = request.query as { url?: string };
    if (!url) return reply.status(400).send();
    validateReferer(request);

    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== 'https:') throw new TypeError(`Invalid URL protocol (${url})`);

      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`Failed to fetch icon: ${response.statusText} (${url})`);

      const contentType = response.headers.get('content-type');
      if (!contentType || !ALLOWED_ICON_CONTENT_TYPES.some((type) => contentType.includes(type))) {
        throw new TypeError(`Invalid content type: ${contentType} (${url})`);
      }

      const iconBuffer = await response.arrayBuffer();
      if (iconBuffer.byteLength > MAX_ICON_SIZE) {
        throw new TypeError(`Icon size exceeds maximum limit (${url})`);
      }

      return reply
        .header('Content-Type', contentType)
        .header('Cache-Control', 'public, max-age=2592000, immutable')
        .header('Access-Control-Allow-Origin', ENV.APP_ENDPOINT)
        .send(Buffer.from(iconBuffer));
    } catch (error) {
      reportError(error);
      if (error instanceof TypeError) return reply.status(400).send();
      return reply.status(500);
    }
  });
};
