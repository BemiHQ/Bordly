import { randomUUID } from 'node:crypto';
import type { EmailDraft } from '@/entities/email-draft';
import { FileAttachment } from '@/entities/file-attachment';
import { orm } from '@/utils/orm';
import { S3Client } from '@/utils/s3-client';

const PREFIX_EMAIL_DRAFTS = 'email-drafts';

export class FileAttachmentService {
  static async createForEmailDraft(
    emailDraft: EmailDraft,
    {
      filename,
      mimeType,
      buffer,
    }: {
      filename: string;
      mimeType: string;
      buffer: Buffer;
    },
  ) {
    const s3Key = `${PREFIX_EMAIL_DRAFTS}/${emailDraft.id}/${randomUUID()}-${filename}`;
    await S3Client.uploadFile({ key: s3Key, buffer, contentType: mimeType });

    const draftAttachment = new FileAttachment({
      emailDraft,
      s3Key,
      filename,
      mimeType,
      size: buffer.length,
    });

    orm.em.persist(draftAttachment);
    await orm.em.flush();

    return draftAttachment;
  }

  static async deleteForEmailDraft(emailDraft: EmailDraft, { fileAttachmentId }: { fileAttachmentId: string }) {
    const attachment = emailDraft.fileAttachments.find((a) => a.id === fileAttachmentId);
    if (!attachment) {
      throw new Error('Attachment not found');
    }

    await S3Client.deleteFile({ key: attachment.s3Key });
    orm.em.remove(attachment);
    await orm.em.flush();
  }

  static async deleteAllForDraft(emailDraft: EmailDraft) {
    const s3Keys = emailDraft.fileAttachments.map((a) => a.s3Key);
    await S3Client.deleteFiles({ keys: s3Keys });

    for (const attachment of emailDraft.fileAttachments) {
      orm.em.remove(attachment);
    }
    await orm.em.flush();
  }
}
