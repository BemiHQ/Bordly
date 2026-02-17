import { Migration } from '@mikro-orm/migrations';

export class Migration20260217123848_add_gmail_accounts_state extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "gmail_accounts" add column "state" text check ("state" in ('ACTIVE', 'INACTIVE')) null;`);
    this.addSql(`update "gmail_accounts" set "state" = 'ACTIVE' where "state" is null;`);
    this.addSql(`alter table "gmail_accounts" alter column "state" set not null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "gmail_accounts" drop column "state";`);
  }
}
