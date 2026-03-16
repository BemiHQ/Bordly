import { RequestContext } from '@mikro-orm/postgresql';
import '@/utils/error-tracking';
import { Logger } from '@/utils/logger';
import { orm } from '@/utils/orm';

const backfillPg = async () => {};

const backfillLancedb = async () => {
  // Logger.info('[MIGRATE] Starting LanceDB backfill for snippet column');
  //
  // const boards = await orm.em.find(Board, {});
  // Logger.info(`[MIGRATE] Found ${boards.length} boards to process`);
  //
  // for (const board of boards) {
  //   Logger.info(`[MIGRATE] Processing board ${board.id}: ${board.name}`);
  //
  //   const tableName = `${board.id}_records`;
  //   const connection = await connect(IndexService.s3Prefix());
  //   const tableNames = await connection.tableNames();
  //
  //   if (tableNames.includes(tableName)) {
  //     const table = await connection.openTable(tableName);
  //     const schema = await table.schema();
  //     const hasSnippetColumn = schema.fields.some((field) => field.name === 'snippet');
  //
  //     if (!hasSnippetColumn) {
  //       Logger.info(`[MIGRATE] Adding snippet column to table ${tableName}`);
  //       await table.addColumns([{ name: 'snippet', valueSql: "''" }]);
  //     } else {
  //       Logger.info(`[MIGRATE] Snippet column already exists in table ${tableName}, skipping`);
  //       continue;
  //     }
  //   }
  //
  //   const boardCards = await orm.em.find(
  //     BoardCard,
  //     { boardColumn: { board }, state: { $in: [BoardCardState.INBOX, BoardCardState.ARCHIVED] } },
  //     { orderBy: { lastEventAt: 'DESC' }, limit: 50 },
  //   );
  //
  //   for (const boardCard of boardCards) {
  //     if (!boardCard.indexable) continue;
  //
  //     const emailMessages = await EmailMessageService.findEmailMessagesByBoardCard(boardCard, {
  //       populate: ['gmailAttachments'],
  //     });
  //     const emailMessageIds = emailMessages.map((em) => em.id);
  //
  //     if (emailMessageIds.length > 0) {
  //       Logger.info(`[MIGRATE] Upserting ${emailMessageIds.length} email messages for board card ${boardCard.id}`);
  //       await IndexService.upsertRecords(board.id, {
  //         entity: 'EmailMessage',
  //         ids: emailMessageIds,
  //         boardCardId: boardCard.id,
  //       });
  //     }
  //
  //     const comments = await CommentService.findCommentsByBoardCard(boardCard, {
  //       populate: ['user'],
  //       orderBy: { createdAt: 'ASC' },
  //     });
  //     const commentIds = comments.map((c) => c.id);
  //
  //     if (commentIds.length > 0) {
  //       Logger.info(`[MIGRATE] Upserting ${commentIds.length} comments for board card ${boardCard.id}`);
  //       await IndexService.upsertRecords(board.id, {
  //         entity: 'Comment',
  //         ids: commentIds,
  //         boardCardId: boardCard.id,
  //       });
  //     }
  //   }
  // }
  //
  // Logger.info('[MIGRATE] LanceDB backfill completed');
};

(async () => {
  try {
    Logger.info('[MIGRATE] Starting PostgreSQL migrations');
    await orm.migrator.up();
    await RequestContext.create(orm.em, backfillPg);
    Logger.info('[MIGRATE] PostgreSQL migrations completed');

    Logger.info('[MIGRATE] Starting LanceDB backfill');
    await RequestContext.create(orm.em, backfillLancedb);
    Logger.info('[MIGRATE] LanceDB backfill completed');
  } catch (error) {
    Logger.error('[MIGRATE] Migration failed', error);
    throw error;
  } finally {
    await orm?.close(true);
  }
})();
