import type { Connection, Table } from '@lancedb/lancedb';
import { Collection, wrap } from '@mikro-orm/core';
import type { Loaded } from '@mikro-orm/postgresql';
import { Field, FixedSizeBinary, Schema, Timestamp, TimeUnit, Utf8 } from 'apache-arrow';
import type { BoardCard } from '@/entities/board-card';
import { EmailMessage } from '@/entities/email-message';
import { GmailAttachment } from '@/entities/gmail-attachment';
import { DomainService } from '@/services/domain.service';
import { EmailMessageService } from '@/services/email-message.service';
import { connect, ensureIndexesExist, IndexType, uuidToBuffer, uuidToQuotedHex } from '@/utils/lancedb';
import { mapBy } from '@/utils/lists';
import { Logger } from '@/utils/logger';
import { orm } from '@/utils/orm';

const S3_PREFIX_ARCHIVE = 'archive';
export const TABLE_NAME = 'email_messages';

interface ArchiveRecord extends Record<string, unknown> {
  id: Buffer;
  external_thread_id: string;
  external_created_at: Date;
  email_message: string;
  gmail_attachments: string;
}

const ARROW_SCHEMA = new Schema([
  new Field('id', new FixedSizeBinary(16)),
  new Field('external_thread_id', new Utf8()),
  new Field('external_created_at', new Timestamp(TimeUnit.MILLISECOND)),
  new Field('email_message', new Utf8()),
  new Field('gmail_attachments', new Utf8()),
]);

const INDEXES = {
  external_thread_id: IndexType.BTREE,
  external_created_at: IndexType.BTREE,
};

export class ArchiveService {
  private static connection: Connection | null = null;
  private static hasAllIndexesCache = false;

  static async archiveBoardCardEmailMessages(boardCard: Loaded<BoardCard>) {
    if (!boardCard.externalThreadId) return;

    const emailMessages = await EmailMessageService.findEmailMessagesByBoardCard(boardCard, {
      populate: ['gmailAttachments', 'rawPayload'],
    });
    if (emailMessages.length === 0) return;

    const table = await ArchiveService.getOrCreateTable();
    const records = emailMessages.map(
      (emailMessage) =>
        ({
          id: uuidToBuffer(emailMessage.id),
          external_thread_id: emailMessage.externalThreadId,
          external_created_at: emailMessage.externalCreatedAt,
          email_message: JSON.stringify(ArchiveService.serializeEntity(emailMessage)),
          gmail_attachments: JSON.stringify(emailMessage.gmailAttachments.map(ArchiveService.serializeEntity)),
        }) as ArchiveRecord,
    );
    await table.add(records);
    await ArchiveService.ensureIndexesExist(table);
    Logger.info(`[ARCHIVE] Archived ${emailMessages.length} email messages for board card ${boardCard.id}`);

    for (const emailMessage of emailMessages) {
      orm.em.remove(emailMessage.gmailAttachments);
    }
    for (const emailMessage of emailMessages) {
      orm.em.remove(emailMessage);
    }
    await orm.em.flush();
  }

  static async restoreBoardCardEmailMessages(boardCard: Loaded<BoardCard>) {
    if (!boardCard.externalThreadId) return;

    const table = await ArchiveService.getOrCreateTable();
    const results = await table
      .query()
      .where(`external_thread_id = '${boardCard.externalThreadId}'`)
      .select(['email_message', 'gmail_attachments'])
      .toArray();
    if (results.length === 0) return;
    const emailMessages = results.map((record: { email_message: string; gmail_attachments: string }) =>
      ArchiveService.deserializeEmailMessage(JSON.parse(record.email_message), JSON.parse(record.gmail_attachments)),
    );

    for (const emailMessage of emailMessages) {
      orm.em.persist(emailMessage);
    }
    await orm.em.flush();
    Logger.info(`[ARCHIVE] Restored ${emailMessages.length} email messages for board card ${boardCard.id}`);

    await table.delete(`external_thread_id = '${boardCard.externalThreadId}'`);
  }

  static async emailMessagesDescByExternalThreadId(externalThreadId: string) {
    const table = await ArchiveService.getOrCreateTable();
    const results = (
      await table
        .query()
        .where(`external_thread_id = '${externalThreadId}'`)
        .select(['email_message', 'gmail_attachments', 'external_created_at'])
        .toArray()
    ).sort((a, b) => (b.external_created_at as number) - (a.external_created_at as number));

    const emailMessages = results.map((record: { email_message: string; gmail_attachments: string }) =>
      ArchiveService.deserializeEmailMessage(JSON.parse(record.email_message), JSON.parse(record.gmail_attachments)),
    );

    const domainIds = emailMessages.map((emailMessage) => emailMessage.domain.id);
    const domainById = mapBy(await DomainService.findByIds(domainIds), (domain) => domain.id);
    return emailMessages.map((emailMessage) => {
      emailMessage.domain = domainById[emailMessage.domain.id]!;
      return emailMessage as Loaded<EmailMessage, 'domain' | 'gmailAttachments'>;
    });
  }

  static async deleteByExternalThreadIds(externalThreadIds: string[]) {
    if (externalThreadIds.length === 0) return;

    const table = await ArchiveService.getOrCreateTable();
    await table.delete(externalThreadIds.map((id) => `external_thread_id = '${id}'`).join(' OR '));
    Logger.info(`[ARCHIVE] Deleted archived messages for ${externalThreadIds.length} threads`);
  }

  static async deleteByEmailMessageIds(emailMessageIds: string[]) {
    if (emailMessageIds.length === 0) return;

    const table = await ArchiveService.getOrCreateTable();
    await table.delete(emailMessageIds.map((id) => `id = ${uuidToQuotedHex(id)}`).join(' OR '));
    Logger.info(`[ARCHIVE] Deleted ${emailMessageIds.length} individual archived messages`);
  }

  static async compactTable() {
    const table = await ArchiveService.getOrCreateTable();
    await table.optimize();
  }

  static s3Prefix() {
    return S3_PREFIX_ARCHIVE;
  }

  // -------------------------------------------------------------------------------------------------------------------

  private static async getConnection() {
    if (!ArchiveService.connection) {
      ArchiveService.connection = await connect(ArchiveService.s3Prefix());
    }
    return ArchiveService.connection;
  }

  private static serializeEntity(entity: Loaded<EmailMessage> | Loaded<GmailAttachment>) {
    if (entity instanceof EmailMessage) {
      return {
        ...wrap(entity).toObject(),
        gmailAccount: { id: entity.gmailAccount.id },
        domain: { id: entity.domain.id },
        gmailAttachments: undefined,
      };
    } else if (entity instanceof GmailAttachment) {
      return {
        ...wrap(entity).toObject(),
        gmailAccount: { id: entity.gmailAccount.id },
        emailMessage: { id: entity.emailMessage.id },
      };
    }
  }

  private static deserializeEmailMessage(
    data: Record<string, unknown>,
    gmailAttachments: Array<Record<string, unknown>>,
  ) {
    const emailMessage = Object.create(EmailMessage.prototype);
    Object.assign(emailMessage, data);
    emailMessage.gmailAttachments = new Collection<GmailAttachment>(emailMessage);
    for (const a of gmailAttachments) {
      const attachment = Object.create(GmailAttachment.prototype);
      Object.assign(attachment, { ...a, emailMessage });
      emailMessage.gmailAttachments.add(attachment);
    }
    return emailMessage as Loaded<EmailMessage, 'gmailAttachments'>;
  }

  private static async getOrCreateTable() {
    const connection = await ArchiveService.getConnection();
    const tableNames = await connection.tableNames();

    if (tableNames.includes(TABLE_NAME)) {
      return await connection.openTable(TABLE_NAME);
    }

    return await connection.createEmptyTable(TABLE_NAME, ARROW_SCHEMA, { mode: 'create' });
  }

  private static async ensureIndexesExist(table: Table) {
    if (ArchiveService.hasAllIndexesCache) return;
    ArchiveService.hasAllIndexesCache = await ensureIndexesExist({ table, indexes: INDEXES });
  }
}
