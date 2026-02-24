import { Migration } from '@mikro-orm/migrations';

export class Migration20260224153054_add_content_html_in_comments extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "comments" add column "content_html" text not null;`);
    this.addSql(`alter table "comments" rename column "text" to "content_text";`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "comments" drop column "content_html";`);

    this.addSql(`alter table "comments" rename column "content_text" to "text";`);
  }
}
