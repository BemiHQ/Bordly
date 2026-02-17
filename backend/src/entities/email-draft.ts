import { Collection, Entity, OneToMany, OneToOne, Property, Unique } from '@mikro-orm/postgresql';
import { BaseEntity } from '@/entities/base-entity';
import type { BoardCard } from '@/entities/board-card';
import type { Participant } from '@/entities/email-message';
import type { FileAttachment } from '@/entities/file-attachment';

export type { Participant } from '@/entities/email-message';

export interface EmailDraft {
  loadedBoardCard: BoardCard;
}

@Entity({ tableName: 'email_drafts' })
@Unique({ properties: ['boardCard'] })
export class EmailDraft extends BaseEntity {
  @OneToOne()
  boardCard: BoardCard;

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
    generated,
    from,
    to,
    cc,
    bcc,
    subject,
    bodyHtml,
  }: {
    boardCard: BoardCard;
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
    this.generated = generated;
    this.from = from;
    this.to = to;
    this.cc = cc;
    this.bcc = bcc;
    this.subject = subject;
    this.bodyHtml = bodyHtml;
    this.validate();
  }

  update({
    generated,
    from,
    to,
    cc,
    bcc,
    subject,
    bodyHtml,
  }: {
    generated: boolean;
    from: Participant;
    to?: Participant[];
    cc?: Participant[];
    bcc?: Participant[];
    subject?: string;
    bodyHtml?: string;
  }) {
    this.generated = generated;
    this.from = from;
    this.to = to;
    this.cc = cc;
    this.bcc = bcc;
    this.subject = subject;
    this.bodyHtml = bodyHtml;
    this.validate();
  }

  toJson() {
    return {
      id: this.id,
      boardCardId: this.boardCard.id,
      generated: this.generated,
      from: this.from,
      to: this.to,
      cc: this.cc,
      bcc: this.bcc,
      subject: this.subject,
      bodyHtml: this.bodyHtml,
      fileAttachments: this.fileAttachments.map((a) => a.toJson()),
    };
  }

  private validate() {
    if (!this.boardCard) throw new Error('Board card is required');
    if (this.generated === undefined || this.generated === null) throw new Error('Generated status is required');
    if (!this.from) throw new Error('From address is required');
  }
}
