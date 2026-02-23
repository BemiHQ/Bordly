import type { FastifyInstance } from 'fastify';
import { FileAttachment } from '@/entities/file-attachment';
import { BoardService } from '@/services/board.service';
import { BoardCardService } from '@/services/board-card.service';
import { FileAttachmentService } from '@/services/file-attachment.service';
import { UserService } from '@/services/user.service';
import { reportError } from '@/utils/error-tracking';
import { ROUTES } from '@/utils/urls';

export const fileAttachmentRoutes = async (fastify: FastifyInstance) => {
  fastify.post(ROUTES.FILE_ATTACHMENT_UPLOAD, async (request, reply) => {
    const { boardId, boardCardId } = request.query as { boardId?: string; boardCardId?: string };
    if (!boardId || !boardCardId) {
      return reply.status(400).send();
    }

    const user = await UserService.tryFindById(request.session.get('userId'), { populate: ['boardMembers.board'] });
    if (!user) {
      return reply.status(401).send();
    }

    try {
      const data = await request.file();
      if (!data) throw new Error(`No file uploaded: ${boardId} (user ID: ${user.id})`);

      const board = BoardService.tryFindAsMember(boardId, { user });
      if (!board) throw new Error(`Board not found: ${boardId} (user ID: ${user.id})`);

      const boardCard = await BoardCardService.findById(board, { boardCardId, populate: ['emailDraft'] });
      const { emailDraft } = boardCard;
      if (!emailDraft) {
        throw new Error(`Email draft not found for board card: ${boardCardId} (user ID: ${user.id})`);
      }

      const buffer = await data.toBuffer();
      const fileAttachment = await FileAttachmentService.createForEmailDraft(emailDraft, {
        filename: data.filename,
        mimeType: data.mimetype,
        buffer,
      });

      return reply.send({ fileAttachment: FileAttachment.toJson(fileAttachment) });
    } catch (error) {
      reportError(error);
      return reply.status(500).send();
    }
  });

  fastify.delete(ROUTES.FILE_ATTACHMENT_DELETE, async (request, reply) => {
    const { boardId, boardCardId, fileAttachmentId } = request.query as {
      boardId?: string;
      boardCardId?: string;
      fileAttachmentId?: string;
    };
    if (!boardId || !boardCardId || !fileAttachmentId) {
      return reply.status(400).send();
    }

    const user = await UserService.tryFindById(request.session.get('userId'), { populate: ['boardMembers.board'] });
    if (!user) {
      return reply.status(401).send();
    }

    try {
      const board = BoardService.tryFindAsMember(boardId, { user });
      if (!board) throw new Error(`Board not found: ${boardId} (user ID: ${user.id})`);

      const boardCard = await BoardCardService.findById(board, {
        boardCardId,
        populate: ['emailDraft.fileAttachments'],
      });
      const { emailDraft } = boardCard;
      if (!emailDraft) {
        throw new Error(`Email draft not found for board card: ${boardCardId} (user ID: ${user.id})`);
      }

      await FileAttachmentService.deleteForEmailDraft(emailDraft, { fileAttachmentId });

      return reply.send({ success: true });
    } catch (error) {
      reportError(error);
      return reply.status(500).send();
    }
  });
};
