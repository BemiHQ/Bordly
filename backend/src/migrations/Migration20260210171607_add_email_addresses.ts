import { Migration } from '@mikro-orm/migrations';

export class Migration20260210171607_add_email_addresses extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "email_addresses" ("id" uuid not null default uuid_generate_v4(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "gmail_account_id" uuid not null, "is_primary" boolean not null, "is_default" boolean not null, "email" varchar(255) not null, "name" varchar(255) null, "reply_to" varchar(255) null, constraint "email_addresses_pkey" primary key ("id"));`,
    );
    this.addSql(
      `alter table "email_addresses" add constraint "email_addresses_gmail_account_id_email_unique" unique ("gmail_account_id", "email");`,
    );

    this.addSql(
      `alter table "email_addresses" add constraint "email_addresses_gmail_account_id_foreign" foreign key ("gmail_account_id") references "gmail_accounts" ("id") on update cascade;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "email_addresses" cascade;`);
  }
}
