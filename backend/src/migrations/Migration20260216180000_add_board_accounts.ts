import { Migration } from '@mikro-orm/migrations';

export class Migration20260216180000_add_board_accounts extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "email_addresses" rename to "sender_email_addresses";`);

    this.addSql(
      `create table "board_accounts" ("id" uuid not null default uuid_generate_v4(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "board_id" uuid not null, "gmail_account_id" uuid not null, "receiving_emails" text[] null, constraint "board_accounts_pkey" primary key ("id"));`,
    );
    this.addSql(`create index "board_accounts_gmail_account_id_index" on "board_accounts" ("gmail_account_id");`);
    this.addSql(
      `alter table "board_accounts" add constraint "board_accounts_board_id_gmail_account_id_unique" unique ("board_id", "gmail_account_id");`,
    );

    this.addSql(
      `alter table "board_accounts" add constraint "board_accounts_board_id_foreign" foreign key ("board_id") references "boards" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "board_accounts" add constraint "board_accounts_gmail_account_id_foreign" foreign key ("gmail_account_id") references "gmail_accounts" ("id") on update cascade;`,
    );

    this.addSql(`alter table "users" alter column "first_name" type varchar(255) using ("first_name"::varchar(255));`);
    this.addSql(`alter table "users" alter column "first_name" set not null;`);

    this.addSql(`alter table "board_cards" rename column "external_participants_asc" to "participants_asc";`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "sender_email_addresses" rename to "email_addresses";`);

    this.addSql(`drop table if exists "board_accounts" cascade;`);

    this.addSql(`alter table "users" alter column "first_name" type varchar(255) using ("first_name"::varchar(255));`);
    this.addSql(`alter table "users" alter column "first_name" drop not null;`);

    this.addSql(`alter table "board_cards" rename column "participants_asc" to "external_participants_asc";`);
  }
}
