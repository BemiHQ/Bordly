import { Migration } from '@mikro-orm/migrations';

export class Migration20260213185900_add_comments_and_read_positions extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "comments" ("id" uuid not null default uuid_generate_v4(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "board_card_id" uuid not null, "user_id" uuid not null, "text" text not null, constraint "comments_pkey" primary key ("id"));`,
    );
    this.addSql(`create index "comments_user_id_index" on "comments" ("user_id");`);
    this.addSql(`create index "comments_board_card_id_index" on "comments" ("board_card_id");`);

    this.addSql(
      `create table "board_card_read_positions" ("id" uuid not null default uuid_generate_v4(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "board_card_id" uuid not null, "user_id" uuid not null, "last_read_at" timestamptz not null, constraint "board_card_read_positions_pkey" primary key ("id"));`,
    );
    this.addSql(
      `alter table "board_card_read_positions" add constraint "board_card_read_positions_board_card_id_user_id_unique" unique ("board_card_id", "user_id");`,
    );

    this.addSql(
      `alter table "comments" add constraint "comments_board_card_id_foreign" foreign key ("board_card_id") references "board_cards" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "comments" add constraint "comments_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "board_card_read_positions" add constraint "board_card_read_positions_board_card_id_foreign" foreign key ("board_card_id") references "board_cards" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "board_card_read_positions" add constraint "board_card_read_positions_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade;`,
    );

    this.addSql(`alter table "gmail_accounts" add constraint "gmail_accounts_user_id_unique" unique ("user_id");`);

    this.addSql(`alter table "board_cards" drop column "has_sent", drop column "unread_email_message_ids";`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "comments" cascade;`);

    this.addSql(`drop table if exists "board_card_read_positions" cascade;`);

    this.addSql(`alter table "gmail_accounts" drop constraint "gmail_accounts_user_id_unique";`);

    this.addSql(
      `alter table "board_cards" add column "has_sent" boolean not null, add column "unread_email_message_ids" jsonb null;`,
    );
  }
}
