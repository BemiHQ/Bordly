import { Migration } from '@mikro-orm/migrations';

export class Migration20260224003834_add_board_account_to_board_cards extends Migration {
  override async up(): Promise<void> {
    // Add board_account_id column (nullable initially)
    this.addSql(`alter table "board_cards" add column "board_account_id" uuid;`);

    // Backfill board_account_id from gmail_account_id
    // For each board_card, find the board_account that matches the gmail_account and board
    this.addSql(`
      update "board_cards"
      set "board_account_id" = subquery.board_account_id
      from (
        select
          bc.id as board_card_id,
          ba.id as board_account_id
        from "board_cards" bc
        inner join "board_columns" bcol on bcol.id = bc.board_column_id
        inner join "board_accounts" ba on ba.gmail_account_id = bc.gmail_account_id and ba.board_id = bcol.board_id
      ) as subquery
      where "board_cards".id = subquery.board_card_id;
    `);

    // Make board_account_id non-nullable
    this.addSql(`alter table "board_cards" alter column "board_account_id" set not null;`);

    // Add foreign key and index for board_account_id
    this.addSql(
      `alter table "board_cards" add constraint "board_cards_board_account_id_foreign" foreign key ("board_account_id") references "board_accounts" ("id") on update cascade;`,
    );
    this.addSql(`create index "board_cards_board_account_id_index" on "board_cards" ("board_account_id");`);

    // Drop old gmail_account_id column
    this.addSql(`alter table "board_cards" drop constraint "board_cards_gmail_account_id_foreign";`);
    this.addSql(`drop index "board_cards_gmail_account_id_index";`);
    this.addSql(`alter table "board_cards" drop column "gmail_account_id";`);
  }

  override async down(): Promise<void> {
    // Add gmail_account_id column back (nullable initially)
    this.addSql(`alter table "board_cards" add column "gmail_account_id" uuid;`);

    // Backfill gmail_account_id from board_account_id
    this.addSql(`
      update "board_cards"
      set "gmail_account_id" = subquery.gmail_account_id
      from (
        select
          bc.id as board_card_id,
          ba.gmail_account_id
        from "board_cards" bc
        inner join "board_accounts" ba on ba.id = bc.board_account_id
      ) as subquery
      where "board_cards".id = subquery.board_card_id;
    `);

    // Make gmail_account_id non-nullable
    this.addSql(`alter table "board_cards" alter column "gmail_account_id" set not null;`);

    // Add foreign key and index for gmail_account_id
    this.addSql(
      `alter table "board_cards" add constraint "board_cards_gmail_account_id_foreign" foreign key ("gmail_account_id") references "gmail_accounts" ("id") on update cascade;`,
    );
    this.addSql(`create index "board_cards_gmail_account_id_index" on "board_cards" ("gmail_account_id");`);

    // Drop board_account_id column
    this.addSql(`alter table "board_cards" drop constraint "board_cards_board_account_id_foreign";`);
    this.addSql(`drop index "board_cards_board_account_id_index";`);
    this.addSql(`alter table "board_cards" drop column "board_account_id";`);
  }
}
