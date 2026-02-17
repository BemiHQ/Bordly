import { Migration } from '@mikro-orm/migrations';

export class Migration20260211015219_use_text_for_email_draft_body_html extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "email_drafts" alter column "body_html" type text using ("body_html"::text);`);
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "email_drafts" alter column "body_html" type varchar(255) using ("body_html"::varchar(255));`,
    );
  }
}
