import { Collection, Entity, ManyToOne, OneToMany, OneToOne, Property, Unique } from '@mikro-orm/postgresql';
import { BaseEntity } from '@/entities/base-entity';
import type { BoardCard } from '@/entities/board-card';
import type { Participant } from '@/entities/email-message';
import type { FileAttachment } from '@/entities/file-attachment';
import type { GmailAccount } from '@/entities/gmail-account';
import { parseHtmlBody } from '@/utils/email';

export type { Participant } from '@/entities/email-message';

export interface EmailDraft {
  loadedBoardCard: BoardCard;
  loadedGmailAccount: GmailAccount;
}

@Entity({ tableName: 'email_drafts' })
@Unique({ properties: ['boardCard'] })
export class EmailDraft extends BaseEntity {
  @OneToOne()
  boardCard: BoardCard;
  @ManyToOne()
  gmailAccount: GmailAccount;

  @OneToMany({ mappedBy: (attachment: FileAttachment) => attachment.emailDraft })
  fileAttachments = new Collection<FileAttachment>(this);

  @Property()
  generated: boolean;

  @Property({ type: 'jsonb' })
  from: Participant;
  @Property({ type: 'jsonb' })
  to?: Participant[];
  @Property({ type: 'jsonb' })
  cc?: Participant[];
  @Property({ type: 'jsonb' })
  bcc?: Participant[];

  @Property()
  subject?: string;
  @Property({ type: 'text' })
  bodyHtml?: string;

  constructor({
    boardCard,
    gmailAccount,
    generated,
    from,
    to,
    cc,
    bcc,
    subject,
    bodyHtml,
  }: {
    boardCard: BoardCard;
    gmailAccount: GmailAccount;
    generated: boolean;
    from: Participant;
    to?: Participant[];
    cc?: Participant[];
    bcc?: Participant[];
    subject?: string;
    bodyHtml?: string;
  }) {
    super();
    this.boardCard = boardCard;
    this.gmailAccount = gmailAccount;
    this.generated = generated;
    this.from = from;
    this.to = to;
    this.cc = cc;
    this.bcc = bcc;
    this.subject = subject;
    this.bodyHtml = bodyHtml;
    this.createdAt = new Date();
    this.validate();
  }

  update({
    gmailAccount,
    generated,
    from,
    to,
    cc,
    bcc,
    subject,
    bodyHtml,
  }: {
    gmailAccount: GmailAccount;
    generated: boolean;
    from: Participant;
    to?: Participant[];
    cc?: Participant[];
    bcc?: Participant[];
    subject?: string;
    bodyHtml?: string;
  }) {
    this.gmailAccount = gmailAccount;
    this.generated = generated;
    this.from = { ...from, email: from.email.toLowerCase() };
    this.to = to?.map((p) => ({ ...p, email: p.email.toLowerCase() }));
    this.cc = cc?.map((p) => ({ ...p, email: p.email.toLowerCase() }));
    this.bcc = bcc?.map((p) => ({ ...p, email: p.email.toLowerCase() }));
    this.subject = subject;
    this.bodyHtml = bodyHtml;
    this.validate();
  }

  toJson() {
    const parsed = this.bodyHtml ? parseHtmlBody(this.bodyHtml) : { mainHtml: '', quotedHtml: '' };

    return {
      id: this.id,
      boardCardId: this.boardCard.id,
      generated: this.generated,
      from: this.from,
      to: this.to,
      cc: this.cc,
      bcc: this.bcc,
      subject: this.subject,
      fileAttachments: this.fileAttachments.map((a) => a.toJson()),
      mainHtml: parsed.mainHtml,
      quotedHtml: parsed.quotedHtml,
    };
  }

  private validate() {
    if (!this.gmailAccount) throw new Error('Gmail account is required');
    if (!this.boardCard) throw new Error('Board card is required');
    if (this.generated === undefined || this.generated === null) throw new Error('Generated status is required');
    if (!this.from) throw new Error('From address is required');
  }
}
