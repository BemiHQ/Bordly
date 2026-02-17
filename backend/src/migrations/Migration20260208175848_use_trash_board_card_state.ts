import { Migration } from '@mikro-orm/migrations';

export class Migration20260208175848_use_trash_board_card_state extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "board_cards" alter column "has_attachments" type boolean using ("has_attachments"::boolean);`,
    );
    this.addSql(`alter table "board_cards" alter column "has_attachments" set not null;`);

    this.addSql(`alter table "board_cards" drop constraint if exists "board_cards_state_check";`);
    this.addSql(`update "board_cards" set "state" = 'TRASH' where "state" = 'TRASHED';`);
    this.addSql(
      `alter table "board_cards" add constraint "board_cards_state_check" check("state" in ('INBOX', 'ARCHIVED', 'SPAM', 'TRASH'));`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "board_cards" alter column "has_attachments" type boolean using ("has_attachments"::boolean);`,
    );
    this.addSql(`alter table "board_cards" alter column "has_attachments" drop not null;`);

    this.addSql(`alter table "board_cards" drop constraint if exists "board_cards_state_check";`);
    this.addSql(`update "board_cards" set "state" = 'TRASHED' where "state" = 'TRASH';`);
    this.addSql(
      `alter table "board_cards" add constraint "board_cards_state_check" check("state" in ('INBOX', 'ARCHIVED', 'SPAM', 'TRASHED'));`,
    );
  }
}
