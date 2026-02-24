import { Collection, Entity, Index, type Loaded, ManyToOne, OneToMany, Property, Unique } from '@mikro-orm/postgresql';
import { BaseEntity } from '@/entities/base-entity';
import { Domain } from '@/entities/domain';
import type { GmailAccount } from '@/entities/gmail-account';
import { GmailAttachment } from '@/entities/gmail-attachment';
import { htmlToText, parseHtmlBody, parseTextBody } from '@/utils/email';
import { type Participant, participantToString } from '@/utils/shared';

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

  @OneToMany({ mappedBy: (attachment: GmailAttachment) => attachment.emailMessage })
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
    this.from = { ...from, email: from.email.toLowerCase() };
    this.subject = subject;
    this.sent = sent;
    this.labels = labels;
    this.snippet = snippet;
    this.to = to?.map((participant) => ({ ...participant, email: participant.email.toLowerCase() }));
    this.replyTo = replyTo ? { ...replyTo, email: replyTo.email.toLowerCase() } : undefined;
    this.cc = cc?.map((participant) => ({ ...participant, email: participant.email.toLowerCase() }));
    this.bcc = bcc?.map((participant) => ({ ...participant, email: participant.email.toLowerCase() }));
    this.bodyText = bodyText;
    this.bodyHtml = bodyHtml;
    this.validate();
  }

  setLabels(labels: string[]) {
    this.labels = labels;
  }

  static toJson(emailMessage: Loaded<EmailMessage, 'domain' | 'gmailAttachments'>) {
    return {
      id: emailMessage.id,
      domain: Domain.toJson(emailMessage.loadedDomain),
      gmailAttachments: emailMessage.gmailAttachments.map(GmailAttachment.toJson),
      from: emailMessage.from,
      subject: emailMessage.subject,
      snippet: emailMessage.snippet,
      to: emailMessage.to,
      replyTo: emailMessage.replyTo,
      cc: emailMessage.cc,
      bcc: emailMessage.bcc,
      externalCreatedAt: emailMessage.externalCreatedAt,
      ...{
        mainHtml: null as string | null,
        quotedHtml: null as string | null,
        styles: null as string | null,
        mainText: null as string | null,
        quotedText: null as string | null,
        ...(emailMessage.bodyHtml ? parseHtmlBody(emailMessage.bodyHtml) : parseTextBody(emailMessage.bodyText || '')),
      },
    };
  }

  static toText(emailMessage: Loaded<EmailMessage>) {
    const items = [
      `ID: ${emailMessage.id}`,
      `Created At: ${emailMessage.externalCreatedAt.toISOString()}`,
      `Subject: ${emailMessage.subject}`,
      `From: ${participantToString(emailMessage.from)}`,
      emailMessage.to && `To: ${emailMessage.to.map(participantToString).join(', ')}`,
      emailMessage.replyTo && `Reply-To: ${participantToString(emailMessage.replyTo)}`,
      emailMessage.cc && `CC: ${emailMessage.cc.map(participantToString).join(', ')}`,
      emailMessage.bcc && `BCC: ${emailMessage.bcc.map(participantToString).join(', ')}`,
      `Sent: ${emailMessage.sent}`,
      `Body:
\`\`\`
${emailMessage.bodyText || emailMessage.bodyHtml}
\`\`\`
`,
    ];

    return `Email Message:
${items.filter(Boolean).join('\n')}`;
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
