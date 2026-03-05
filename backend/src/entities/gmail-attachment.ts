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

  @Property()
  summary?: string;

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

  setSummary(summary: string) {
    this.summary = summary;
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

  static toPrompt(gmailAttachment: Loaded<GmailAttachment>) {
    const items = [
      `- ID: ${gmailAttachment.id}`,
      `- Filename: ${gmailAttachment.filename}`,
      gmailAttachment.summary && `- Summary: ${gmailAttachment.summary}`,
    ].filter(Boolean);

    return `Gmail Attachment:
${items.join('\n')}`;
  }

  private validate() {
    if (!this.gmailAccount) throw new Error('Gmail Account is required');
    if (!this.emailMessage) throw new Error('Email Message is required');
    if (!this.externalId) throw new Error('External ID is required');
    if (this.filename === undefined || this.filename === null) throw new Error('Filename is required');
    if (!this.mimeType) throw new Error('MIME type is required');
    if (this.size === undefined || this.size === null || this.size < 0)
      throw new Error('Size must be a non-negative number');
    if (this.summary === '') throw new Error('Summary cannot be an empty string');
  }
}
