import { Collection, Entity, Index, ManyToOne, OneToMany, Property, Unique } from '@mikro-orm/postgresql';
import type { Attachment } from '@/entities/attachment';
import { BaseEntity } from '@/entities/base-entity';
import type { GmailAccount } from '@/entities/gmail-account';

export interface Participant {
  name: string | null;
  email: string;
}

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

  @Property({ type: 'jsonb' })
  from: Participant;
  @Property({ type: 'jsonb', nullable: true })
  to?: Participant[];
  @Property({ type: 'jsonb', nullable: true })
  replyTo?: Participant;
  @Property({ type: 'jsonb', nullable: true })
  cc?: Participant[];
  @Property({ type: 'jsonb', nullable: true })
  bcc?: Participant[];

  @Property()
  sent: boolean;
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
    sent,
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
    from: Participant;
    subject: string;
    snippet: string;
    sent: boolean;
    labels: string[];
    to?: Participant[];
    replyTo?: Participant;
    cc?: Participant[];
    bcc?: Participant[];
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
    this.sent = sent;
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

  setLabels(labels: string[]) {
    this.labels = labels;
  }

  toJson() {
    return {
      id: this.id,
      from: this.from,
      subject: this.subject,
      snippet: this.snippet,
      to: this.to,
      cc: this.cc,
      bcc: this.bcc,
      sent: this.sent,
      externalCreatedAt: this.externalCreatedAt,
    };
  }

  private validate() {
    if (!this.gmailAccount) throw new Error('Gmail Account is required');
    if (!this.externalId) throw new Error('External ID is required');
    if (!this.externalThreadId) throw new Error('External Thread ID is required');
    if (!this.externalCreatedAt) throw new Error('External Created At is required');
    if (!this.from) throw new Error('From address is required');
    if (!this.subject) throw new Error('Subject is required');
    if (!this.snippet) throw new Error('Snippet is required');
    if (!this.sent && this.sent !== false) throw new Error('Sent status is required');
    if (!this.labels) throw new Error('Labels are required');
    if (this.to && this.to.length === 0) throw new Error('To address list cannot be empty if provided');
    if (this.cc && this.cc.length === 0) throw new Error('CC address list cannot be empty if provided');
    if (this.bcc && this.bcc.length === 0) throw new Error('BCC address list cannot be empty if provided');
  }
}
