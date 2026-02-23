import { Migration } from '@mikro-orm/migrations';

export class Migration20260223220607_add_last_edited_by_user_to_drafts extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "email_drafts" drop constraint "email_drafts_gmail_account_id_foreign";`);

    this.addSql(`alter table "email_drafts" rename column "gmail_account_id" to "last_edited_by_user_id";`);
    this.addSql(
      `alter table "email_drafts" add constraint "email_drafts_last_edited_by_user_id_foreign" foreign key ("last_edited_by_user_id") references "users" ("id") on update cascade;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "email_drafts" drop constraint "email_drafts_last_edited_by_user_id_foreign";`);

    this.addSql(`alter table "email_drafts" rename column "last_edited_by_user_id" to "gmail_account_id";`);
    this.addSql(
      `alter table "email_drafts" add constraint "email_drafts_gmail_account_id_foreign" foreign key ("gmail_account_id") references "gmail_accounts" ("id") on update cascade;`,
    );
  }
}
