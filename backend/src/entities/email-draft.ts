import {
  Collection,
  Entity,
  type Loaded,
  ManyToOne,
  OneToMany,
  OneToOne,
  Property,
  Unique,
} from '@mikro-orm/postgresql';
import { BaseEntity } from '@/entities/base-entity';
import type { BoardCard } from '@/entities/board-card';
import { FileAttachment } from '@/entities/file-attachment';
import type { User } from '@/entities/user';
import { htmlToText, parseHtmlBody } from '@/utils/email';
import { type Participant, participantToString } from '@/utils/shared';

export interface EmailDraft {
  loadedBoardCard: BoardCard;
  loadedLastEditedByUser: User;
}

@Entity({ tableName: 'email_drafts' })
@Unique({ properties: ['boardCard'] })
export class EmailDraft extends BaseEntity {
  @OneToOne()
  boardCard: BoardCard;
  @ManyToOne()
  lastEditedByUser: User;

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
    lastEditedByUser,
    generated,
    from,
    to,
    cc,
    bcc,
    subject,
    bodyHtml,
  }: {
    boardCard: BoardCard;
    lastEditedByUser: User;
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
    this.lastEditedByUser = lastEditedByUser;
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
    lastEditedByUser,
    generated,
    from,
    to,
    cc,
    bcc,
    subject,
    bodyHtml,
  }: {
    lastEditedByUser: User;
    generated: boolean;
    from: Participant;
    to?: Participant[];
    cc?: Participant[];
    bcc?: Participant[];
    subject?: string;
    bodyHtml?: string;
  }) {
    this.lastEditedByUser = lastEditedByUser;
    this.generated = generated;
    this.from = { ...from, email: from.email.toLowerCase() };
    this.to = to?.map((p) => ({ ...p, email: p.email.toLowerCase() }));
    this.cc = cc?.map((p) => ({ ...p, email: p.email.toLowerCase() }));
    this.bcc = bcc?.map((p) => ({ ...p, email: p.email.toLowerCase() }));
    this.subject = subject;
    this.bodyHtml = bodyHtml;
    this.validate();
  }

  static toJson(emailDraft: Loaded<EmailDraft, 'fileAttachments'>) {
    const parsed = emailDraft.bodyHtml ? parseHtmlBody(emailDraft.bodyHtml) : { mainHtml: '', quotedHtml: '' };

    return {
      id: emailDraft.id,
      boardCardId: emailDraft.boardCard.id,
      lastEditedByUserId: emailDraft.lastEditedByUser.id,
      generated: emailDraft.generated,
      from: emailDraft.from,
      to: emailDraft.to,
      cc: emailDraft.cc,
      bcc: emailDraft.bcc,
      subject: emailDraft.subject,
      fileAttachments: emailDraft.fileAttachments.map(FileAttachment.toJson),
      mainHtml: parsed.mainHtml,
      quotedHtml: parsed.quotedHtml,
      updatedAt: emailDraft.updatedAt,
    };
  }

  static toText(emailDraft: Loaded<EmailDraft, 'fileAttachments'>) {
    const { fileAttachments } = emailDraft;

    const parsed = emailDraft.bodyHtml ? parseHtmlBody(emailDraft.bodyHtml) : { mainHtml: '' };
    const mainText = htmlToText(parsed.mainHtml);

    const items = [
      `ID: ${emailDraft.id}`,
      `Subject: ${emailDraft.subject}`,
      `From: ${emailDraft.from.email}`,
      emailDraft.to && `To: ${emailDraft.to.map(participantToString).join(', ')}`,
      emailDraft.cc && `CC: ${emailDraft.cc.map(participantToString).join(', ')}`,
      emailDraft.bcc && `BCC: ${emailDraft.bcc.map(participantToString).join(', ')}`,
      `File Attachments: ${fileAttachments.map(FileAttachment.toString).join(', ')}`,
      `Body:
\`\`\`
${mainText}
\`\`\`
`,
    ];

    return `Email Draft:
${items.join('\n')}`;
  }

  private validate() {
    if (!this.boardCard) throw new Error('Board card is required');
    if (!this.lastEditedByUser) throw new Error('Last edited by user is required');
    if (this.generated === undefined || this.generated === null) throw new Error('Generated status is required');
    if (!this.from) throw new Error('From address is required');
  }
}
