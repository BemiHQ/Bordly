import { Collection, Entity, Index, ManyToOne, OneToMany, Property, Unique } from '@mikro-orm/postgresql';
import type { Attachment } from '@/entities/attachment';
import { BaseEntity } from '@/entities/base-entity';
import type { GmailAccount } from '@/entities/gmail-account';

@Entity({ tableName: 'email_messages' })
@Unique({ properties: ['gmailAccount', 'externalId'] })
@Index({ properties: ['externalThreadId'] })
@Index({ properties: ['externalCreatedAt'] })
export class EmailMessage extends BaseEntity {
  @ManyToOne()
  gmailAccount: GmailAccount;

  @OneToMany({ mappedBy: (attachment: Attachment) => attachment.emailMessage })
  attachments = new Collection<Attachment>(this);

  @Property()
  externalId: string;
  @Property()
  externalThreadId: string;
  @Property()
  externalCreatedAt: Date;

  @Property()
  from: string;
  @Property({ nullable: true })
  to?: string[];
  @Property({ nullable: true })
  replyTo?: string;
  @Property({ nullable: true })
  cc?: string[];
  @Property({ nullable: true })
  bcc?: string[];
  @Property()
  labels: string[];

  @Property()
  subject: string;
  @Property()
  snippet: string;
  @Property({ type: 'text', nullable: true })
  bodyText?: string;
  @Property({ type: 'text', nullable: true })
  bodyHtml?: string;

  constructor({
    gmailAccount,
    externalId,
    externalThreadId,
    externalCreatedAt,
    from,
    subject,
    labels,
    snippet,
    to,
    replyTo,
    cc,
    bcc,
    bodyText,
    bodyHtml,
  }: {
    gmailAccount: GmailAccount;
    externalId: string;
    externalThreadId: string;
    externalCreatedAt: Date;
    from: string;
    subject: string;
    snippet: string;
    labels: string[];
    to?: string[];
    replyTo?: string;
    cc?: string[];
    bcc?: string[];
    bodyText?: string;
    bodyHtml?: string;
  }) {
    super();
    this.gmailAccount = gmailAccount;
    this.externalId = externalId;
    this.externalThreadId = externalThreadId;
    this.externalCreatedAt = externalCreatedAt;
    this.from = from;
    this.subject = subject;
    this.labels = labels;
    this.snippet = snippet;
    this.to = to;
    this.replyTo = replyTo;
    this.cc = cc;
    this.bcc = bcc;
    this.bodyText = bodyText;
    this.bodyHtml = bodyHtml;
    this.validate();
  }

  toJson() {
    return {
      id: this.id,
      from: this.from,
      subject: this.subject,
      snippet: this.snippet,
      to: this.to,
    };
  }

  private validate() {
    if (!this.gmailAccount) throw new Error('Gmail Account is required');
    if (!this.externalId) throw new Error('External ID is required');
    if (!this.externalThreadId) throw new Error('External Thread ID is required');
    if (!this.externalCreatedAt) throw new Error('External Created At is required');
    if (!this.from) throw new Error('From address is required');
    if (!this.labels) throw new Error('Labels are required');
    if (!this.subject) throw new Error('Subject is required');
    if (!this.snippet) throw new Error('Snippet is required');
  }
}
