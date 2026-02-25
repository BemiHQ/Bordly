import { Entity, Index, type Loaded, ManyToOne, Property, Unique } from '@mikro-orm/postgresql';

import { BaseEntity } from '@/entities/base-entity';
import type { EmailMessage } from '@/entities/email-message';
import type { GmailAccount } from '@/entities/gmail-account';

export interface GmailAttachment {
  loadedGmailAccount: GmailAccount;
  loadedEmailMessage: EmailMessage;
}

@Entity({ tableName: 'gmail_attachments' })
@Unique({ properties: ['gmailAccount', 'externalId'] })
@Index({ properties: ['emailMessage'] })
export class GmailAttachment extends BaseEntity {
  @ManyToOne()
  gmailAccount: GmailAccount;
  @ManyToOne()
  emailMessage: EmailMessage;

  @Property({ columnType: 'text' })
  externalId: string;
  @Property()
  filename: string;
  @Property()
  mimeType: string;
  @Property()
  size: number;
  @Property()
  contentId?: string;

  constructor({
    gmailAccount,
    emailMessage,
    externalId,
    filename,
    mimeType,
    size,
    contentId,
  }: {
    gmailAccount: GmailAccount;
    emailMessage: EmailMessage;
    externalId: string;
    filename: string;
    mimeType: string;
    size: number;
    contentId?: string;
  }) {
    super();
    this.gmailAccount = gmailAccount;
    this.emailMessage = emailMessage;
    this.externalId = externalId;
    this.filename = filename;
    this.mimeType = mimeType;
    this.size = size;
    this.contentId = contentId;
    this.validate();
  }

  static toJson(gmailAttachment: Loaded<GmailAttachment>) {
    return {
      id: gmailAttachment.id,
      mimeType: gmailAttachment.mimeType,
      filename: gmailAttachment.filename,
      size: gmailAttachment.size,
      contentId: gmailAttachment.contentId,
    };
  }

  static toStr(gmailAttachment: Loaded<GmailAttachment>) {
    return `${gmailAttachment.filename} (ID ${gmailAttachment.id})`;
  }

  private validate() {
    if (!this.gmailAccount) throw new Error('Gmail Account is required');
    if (!this.emailMessage) throw new Error('Email Message is required');
    if (!this.externalId) throw new Error('External ID is required');
    if (this.filename === undefined || this.filename === null) throw new Error('Filename is required');
    if (!this.mimeType) throw new Error('MIME type is required');
    if (this.size === undefined || this.size === null || this.size < 0)
      throw new Error('Size must be a non-negative number');
  }
}
