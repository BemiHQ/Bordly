import { Entity, Index, ManyToOne, Property, Unique } from '@mikro-orm/postgresql';

import { BaseEntity } from '@/entities/base-entity';
import type { EmailMessage } from '@/entities/email-message';
import type { GmailAccount } from '@/entities/gmail-account';

@Entity({ tableName: 'attachements' })
@Unique({ properties: ['gmailAccount', 'externalId'] })
@Index({ properties: ['emailMessage'] })
export class Attachment extends BaseEntity {
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

  constructor({
    gmailAccount,
    emailMessage,
    externalId,
    filename,
    mimeType,
    size,
  }: {
    gmailAccount: GmailAccount;
    emailMessage: EmailMessage;
    externalId: string;
    filename: string;
    mimeType: string;
    size: number;
  }) {
    super();
    this.gmailAccount = gmailAccount;
    this.emailMessage = emailMessage;
    this.externalId = externalId;
    this.filename = filename;
    this.mimeType = mimeType;
    this.size = size;
    this.validate();
  }

  private validate() {
    if (!this.gmailAccount) throw new Error('Gmail Account is required');
    if (!this.emailMessage) throw new Error('Email Message is required');
    if (!this.externalId) throw new Error('External ID is required');
    if (!this.filename) throw new Error('Filename is required');
    if (!this.mimeType) throw new Error('MIME type is required');
    if (this.size < 0) throw new Error('Size must be a non-negative number');
  }
}
