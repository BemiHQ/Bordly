import { Migration } from '@mikro-orm/migrations';

export class Migration20260219171537_allow_null_board_cards_external_thread_id extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "gmail_accounts" alter column "state" type text using ("state"::text);`);
    this.addSql(`alter table "gmail_accounts" alter column "state" set not null;`);

    this.addSql(
      `alter table "board_cards" alter column "external_thread_id" type varchar(255) using ("external_thread_id"::varchar(255));`,
    );
    this.addSql(`alter table "board_cards" alter column "external_thread_id" drop not null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "gmail_accounts" alter column "state" type text using ("state"::text);`);
    this.addSql(`alter table "gmail_accounts" alter column "state" drop not null;`);

    this.addSql(
      `alter table "board_cards" alter column "external_thread_id" type varchar(255) using ("external_thread_id"::varchar(255));`,
    );
    this.addSql(`alter table "board_cards" alter column "external_thread_id" set not null;`);
  }
}
