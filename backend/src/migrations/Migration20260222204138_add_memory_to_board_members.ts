import { Migration } from '@mikro-orm/migrations';

export class Migration20260222204138_add_memory_to_board_members extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "board_members" add column "memory" jsonb null;`);

    this.addSql(`alter table "email_drafts" add column "gmail_account_id" uuid not null;`);
    this.addSql(
      `alter table "email_drafts" add constraint "email_drafts_gmail_account_id_foreign" foreign key ("gmail_account_id") references "gmail_accounts" ("id") on update cascade;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "email_drafts" drop constraint "email_drafts_gmail_account_id_foreign";`);

    this.addSql(`alter table "board_members" drop column "memory";`);

    this.addSql(`alter table "email_drafts" drop column "gmail_account_id";`);
  }
}
