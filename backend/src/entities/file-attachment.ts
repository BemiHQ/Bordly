import { Entity, type Loaded, ManyToOne, Property, Unique } from '@mikro-orm/postgresql';

import { BaseEntity } from '@/entities/base-entity';
import type { EmailDraft } from '@/entities/email-draft';

export interface FileAttachment {
  loadedEmailDraft: EmailDraft;
}

@Entity({ tableName: 'file_attachments' })
@Unique({ properties: ['emailDraft', 'filename'] })
@Unique({ properties: ['s3Key'] })
export class FileAttachment extends BaseEntity {
  @ManyToOne()
  emailDraft: EmailDraft;

  @Property({ columnType: 'text' })
  s3Key: string;
  @Property()
  filename: string;
  @Property()
  mimeType: string;
  @Property()
  size: number;

  constructor({
    emailDraft,
    s3Key,
    filename,
    mimeType,
    size,
  }: {
    emailDraft: EmailDraft;
    s3Key: string;
    filename: string;
    mimeType: string;
    size: number;
  }) {
    super();
    this.emailDraft = emailDraft;
    this.s3Key = s3Key;
    this.filename = filename;
    this.mimeType = mimeType;
    this.size = size;
    this.validate();
  }

  static toJson(fileAttachment: Loaded<FileAttachment>) {
    return {
      id: fileAttachment.id,
      filename: fileAttachment.filename,
      mimeType: fileAttachment.mimeType,
      size: fileAttachment.size,
    };
  }

  static toStr(fileAttachment: Loaded<FileAttachment>) {
    return `${fileAttachment.filename} (ID ${fileAttachment.mimeType})`;
  }

  private validate() {
    if (!this.emailDraft) throw new Error('Email Draft is required');
    if (!this.s3Key) throw new Error('S3 Key is required');
    if (!this.filename) throw new Error('Filename is required');
    if (!this.mimeType) throw new Error('MIME type is required');
    if (this.size === undefined || this.size === null || this.size < 0)
      throw new Error('Size must be a non-negative number');
  }
}
