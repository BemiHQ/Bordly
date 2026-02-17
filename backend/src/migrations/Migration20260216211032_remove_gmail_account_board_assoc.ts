import { Migration } from '@mikro-orm/migrations';

export class Migration20260216211032_remove_gmail_account_board_assoc extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "gmail_accounts" drop constraint "gmail_accounts_board_id_foreign";`);

    this.addSql(`alter table "gmail_accounts" drop column "board_id";`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "gmail_accounts" add column "board_id" uuid null;`);
    this.addSql(
      `alter table "gmail_accounts" add constraint "gmail_accounts_board_id_foreign" foreign key ("board_id") references "boards" ("id") on update cascade on delete set null;`,
    );
  }
}
