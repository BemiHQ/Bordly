import { RequestContext } from '@mikro-orm/postgresql';
import '@/utils/error-tracking';
import { BoardCard } from '@/entities/board-card';
import { EmailMessageService } from '@/services/email-message.service';
import { orm } from '@/utils/orm';

const backfill = async () => {
  const boardCards = await orm.em.find(BoardCard, { hasAttachments: null }, { populate: ['boardColumn.board'] });
  for (const boardCard of boardCards) {
    const { emailMessages } = await EmailMessageService.findEmailMessages(boardCard.boardColumn.board, {
      boardCardId: boardCard.id,
      populate: ['attachments'],
    });

    boardCard.hasAttachments = emailMessages.some((emailMessage) => emailMessage.attachments.length > 0);
    await orm.em.flush();
  }
};

(async () => {
  try {
    await orm.migrator.up();
    await RequestContext.create(orm.em, backfill);
  } finally {
    await orm?.close(true);
  }
})();
