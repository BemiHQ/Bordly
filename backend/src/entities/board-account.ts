import { Entity, Index, ManyToOne, Property, Unique } from '@mikro-orm/postgresql';

import { BaseEntity } from '@/entities/base-entity';
import type { Board } from '@/entities/board';
import type { GmailAccount } from '@/entities/gmail-account';

export interface BoardAccount {
  loadedBoard: Board;
  loadedGmailAccount: GmailAccount;
}

@Entity({ tableName: 'board_accounts' })
@Unique({ properties: ['board', 'gmailAccount'] })
@Index({ properties: ['gmailAccount'] })
export class BoardAccount extends BaseEntity {
  @ManyToOne()
  board: Board;
  @ManyToOne()
  gmailAccount: GmailAccount;

  @Property()
  receivingEmails?: string[]; // TODO: Make unique together with gmailAccount

  constructor({
    board,
    gmailAccount,
    receivingEmails,
  }: { board: Board; gmailAccount: GmailAccount; receivingEmails?: string[] }) {
    super();
    this.board = board;
    this.gmailAccount = gmailAccount;
    this.receivingEmails = receivingEmails?.map((email) => email.toLowerCase());
    this.validate();
  }

  get syncAll() {
    return !this.receivingEmails;
  }

  setReceivingEmails(emails?: string[]) {
    this.receivingEmails = emails?.map((email) => email.toLowerCase());
    this.validate();
  }

  toJson() {
    return {
      id: this.id,
      receivingEmails: this.receivingEmails,
      gmailAccount: this.loadedGmailAccount.toJson(),
    };
  }

  private validate() {
    if (!this.board) throw new Error('Board is required');
    if (!this.gmailAccount) throw new Error('Gmail account is required');
    if (this.receivingEmails?.length === 0) throw new Error('Receiving emails cannot be an empty array');
  }
}
