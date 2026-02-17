import { Migration } from '@mikro-orm/migrations';

export class Migration20260213204801_add_comments_edited_at extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "board_cards" rename column "participants" to "external_participants_asc";`);

    this.addSql(`alter table "comments" add column "edited_at" timestamptz null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "board_cards" rename column "external_participants_asc" to "participants";`);

    this.addSql(`alter table "comments" drop column "edited_at";`);
  }
}
