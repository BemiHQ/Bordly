import { Migration } from '@mikro-orm/migrations';

export class Migration20260305222446_store_raw_email_message_payload extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "email_messages" add column "raw_payload" jsonb;`);
    this.addSql(`update "email_messages" set "raw_payload" = '{}' where "raw_payload" is null;`);
    this.addSql(`alter table "email_messages" alter column "raw_payload" set not null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "email_messages" drop column "raw_payload";`);
  }
}
