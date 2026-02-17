import { Migration } from '@mikro-orm/migrations';

export class Migration20260206182557_add_attachements_to_board_cards extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "board_cards" add column "has_attachments" boolean null;`);

    this.addSql(`alter table "attachements" add column "content_id" varchar(255) null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "board_cards" drop column "has_attachments";`);

    this.addSql(`alter table "attachements" drop column "content_id";`);
  }
}
