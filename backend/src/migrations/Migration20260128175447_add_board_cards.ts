import { Migration } from '@mikro-orm/migrations';

export class Migration20260128175447_add_board_cards extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "board_columns" ("id" uuid not null default uuid_generate_v4(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "board_id" uuid not null, "name" varchar(255) not null, "description" text not null, "position" int not null, constraint "board_columns_pkey" primary key ("id"));`,
    );
    this.addSql(
      `alter table "board_columns" add constraint "board_columns_board_id_name_unique" unique ("board_id", "name");`,
    );
    this.addSql(
      `alter table "board_columns" add constraint "board_columns_board_id_position_unique" unique ("board_id", "position");`,
    );

    this.addSql(
      `create table "board_cards" ("id" uuid not null default uuid_generate_v4(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "board_id" uuid not null, "board_column_id" uuid not null, "external_thread_id" varchar(255) not null, "pinned_position" int null, constraint "board_cards_pkey" primary key ("id"));`,
    );
    this.addSql(`create index "board_cards_board_id_index" on "board_cards" ("board_id");`);
    this.addSql(
      `alter table "board_cards" add constraint "board_cards_board_column_id_pinned_position_unique" unique ("board_column_id", "pinned_position");`,
    );

    this.addSql(
      `alter table "board_columns" add constraint "board_columns_board_id_foreign" foreign key ("board_id") references "boards" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "board_cards" add constraint "board_cards_board_id_foreign" foreign key ("board_id") references "boards" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "board_cards" add constraint "board_cards_board_column_id_foreign" foreign key ("board_column_id") references "board_columns" ("id") on update cascade;`,
    );

    this.addSql(`alter table "boards" add column "slug" varchar(255) not null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "board_cards" drop constraint "board_cards_board_column_id_foreign";`);

    this.addSql(`drop table if exists "board_columns" cascade;`);

    this.addSql(`drop table if exists "board_cards" cascade;`);

    this.addSql(`alter table "boards" drop column "slug";`);
  }
}
