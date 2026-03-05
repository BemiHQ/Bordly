import { Migration } from '@mikro-orm/migrations';

export class Migration20260305125857_allow_null_summary_in_file_attachments extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "file_attachments" alter column "summary" type varchar(255) using ("summary"::varchar(255));`,
    );
    this.addSql(`alter table "file_attachments" alter column "summary" drop not null;`);
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "file_attachments" alter column "summary" type varchar(255) using ("summary"::varchar(255));`,
    );
    this.addSql(`alter table "file_attachments" alter column "summary" set not null;`);
  }
}
