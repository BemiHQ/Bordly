import { Collection, Entity, Index, ManyToOne, OneToMany, Property, Unique } from '@mikro-orm/postgresql';
import { BaseEntity } from '@/entities/base-entity';
import type { Domain } from '@/entities/domain';
import type { GmailAccount } from '@/entities/gmail-account';
import type { GmailAttachment } from '@/entities/gmail-attachment';

export interface Participant {
  name: string | null;
  email: string;
}

export interface EmailMessage {
  loadedGmailAccount: GmailAccount;
  loadedDomain: Domain;
}

@Entity({ tableName: 'email_messages' })
@Unique({ properties: ['gmailAccount', 'externalId'] })
@Index({ properties: ['externalThreadId'] })
@Index({ properties: ['externalCreatedAt'] })
export class EmailMessage extends BaseEntity {
  @ManyToOne()
  gmailAccount: GmailAccount;
  @ManyToOne()
  domain: Domain;

  @OneToMany({ mappedBy: (attachment: GmailAttachment) => attachment.emailMessage, orphanRemoval: true })
  gmailAttachments = new Collection<GmailAttachment>(this);

  @Property()
  externalId: string;
  @Property()
  externalThreadId: string;
  @Property()
  externalCreatedAt: Date;

  @Property()
  messageId?: string;
  @Property({ type: 'text' })
  references?: string;

  @Property({ type: 'jsonb' })
  from: Participant;
  @Property({ type: 'jsonb' })
  to?: Participant[];
  @Property({ type: 'jsonb' })
  replyTo?: Participant;
  @Property({ type: 'jsonb' })
  cc?: Participant[];
  @Property({ type: 'jsonb' })
  bcc?: Participant[];

  @Property()
  sent: boolean; // Not really needed
  @Property()
  labels: string[];

  @Property()
  subject: string;
  @Property()
  snippet: string;
  @Property({ type: 'text' })
  bodyText?: string;
  @Property({ type: 'text' })
  bodyHtml?: string;

  constructor({
    gmailAccount,
    domain,
    externalId,
    externalThreadId,
    externalCreatedAt,
    messageId,
    references,
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
    domain: Domain;
    externalId: string;
    externalThreadId: string;
    externalCreatedAt: Date;
    messageId?: string;
    references?: string;
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
    this.domain = domain;
    this.externalId = externalId;
    this.externalThreadId = externalThreadId;
    this.externalCreatedAt = externalCreatedAt;
    this.messageId = messageId;
    this.references = references;
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
      domain: this.loadedDomain.toJson(),
      gmailAttachments: this.gmailAttachments.map((attachment) => attachment.toJson()),
      from: this.from,
      subject: this.subject,
      snippet: this.snippet,
      to: this.to,
      cc: this.cc,
      bcc: this.bcc,
      externalCreatedAt: this.externalCreatedAt,
      bodyHtml: this.bodyHtml,
      bodyText: this.bodyHtml ? undefined : this.bodyText,
    };
  }

  private validate() {
    if (!this.gmailAccount) throw new Error('Gmail Account is required');
    if (!this.domain) throw new Error('Domain is required');
    if (!this.externalId) throw new Error('External ID is required');
    if (!this.externalThreadId) throw new Error('External Thread ID is required');
    if (!this.externalCreatedAt) throw new Error('External Created At is required');
    if (!this.from) throw new Error('From address is required');
    if (!this.subject) throw new Error('Subject is required');
    if (this.snippet === undefined || this.snippet === null) throw new Error('Snippet is required');
    if (!this.sent && this.sent !== false) throw new Error('Sent status is required');
    if (!this.labels) throw new Error('Labels are required');
    if (this.to && this.to.length === 0) throw new Error('To address list cannot be empty if provided');
    if (this.cc && this.cc.length === 0) throw new Error('CC address list cannot be empty if provided');
    if (this.bcc && this.bcc.length === 0) throw new Error('BCC address list cannot be empty if provided');
  }
}
