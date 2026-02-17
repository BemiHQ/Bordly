import { Entity, ManyToOne, Property, Unique } from '@mikro-orm/postgresql';
import { BaseEntity } from '@/entities/base-entity';
import type { GmailAccount } from '@/entities/gmail-account';

export interface SenderEmailAddress {
  loadedGmailAccount: GmailAccount;
}

@Entity({ tableName: 'sender_email_addresses' })
@Unique({ properties: ['gmailAccount', 'email'] })
export class SenderEmailAddress extends BaseEntity {
  @ManyToOne()
  gmailAccount: GmailAccount;

  @Property()
  isPrimary: boolean;
  @Property()
  isDefault: boolean;

  @Property()
  email: string;
  @Property()
  name?: string;
  @Property()
  replyTo?: string;

  constructor({
    gmailAccount,
    isPrimary,
    isDefault,
    email,
    name,
    replyTo,
  }: {
    gmailAccount: GmailAccount;
    isPrimary: boolean;
    isDefault: boolean;
    email: string;
    name?: string;
    replyTo?: string;
  }) {
    super();
    this.gmailAccount = gmailAccount;
    this.isPrimary = isPrimary;
    this.isDefault = isDefault;
    this.email = email.toLowerCase();
    this.name = name;
    this.replyTo = replyTo;
    this.validate();
  }

  update({
    isPrimary,
    isDefault,
    name,
    replyTo,
  }: {
    isPrimary: boolean;
    isDefault: boolean;
    name?: string;
    replyTo?: string;
  }) {
    this.isPrimary = isPrimary;
    this.isDefault = isDefault;
    this.name = name;
    this.replyTo = replyTo;
    this.validate();
  }

  toJson() {
    return {
      id: this.id,
      isPrimary: this.isPrimary,
      isDefault: this.isDefault,
      email: this.email,
      name: this.name,
      replyTo: this.replyTo,
    };
  }

  private validate() {
    if (!this.gmailAccount) throw new Error('GmailAccount is required');
    if (!this.email) throw new Error('Email is required');
    if (this.isPrimary === undefined || this.isPrimary === null) throw new Error('isPrimary is required');
    if (this.isDefault === undefined || this.isDefault === null) throw new Error('isDefault is required');
  }
}
