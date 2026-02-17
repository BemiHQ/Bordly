import { Entity, ManyToOne, Property, Unique } from '@mikro-orm/postgresql';
import { BaseEntity } from '@/entities/base-entity';
import type { BoardCard } from '@/entities/board-card';
import type { Participant } from '@/entities/email-message';

@Entity({ tableName: 'email_drafts' })
@Unique({ properties: ['boardCard'] })
export class EmailDraft extends BaseEntity {
  @ManyToOne()
  boardCard: BoardCard;

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
  @Property()
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

  private validate() {
    if (!this.boardCard) throw new Error('Board card is required');
    if (this.generated === undefined || this.generated === null) throw new Error('Generated status is required');
    if (!this.from) throw new Error('From address is required');
  }
}
