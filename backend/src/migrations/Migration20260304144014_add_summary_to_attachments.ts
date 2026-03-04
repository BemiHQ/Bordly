import { Migration } from '@mikro-orm/migrations';

export class Migration20260304144014_add_summary_to_attachments extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "gmail_attachments" add column "summary" varchar(255) null;`);

    this.addSql(`alter table "file_attachments" add column "summary" varchar(255) not null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "gmail_attachments" drop column "summary";`);

    this.addSql(`alter table "file_attachments" drop column "summary";`);
  }
}
