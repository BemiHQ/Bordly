import { Migration } from '@mikro-orm/migrations';

export class Migration20260126210616_add_boards extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "boards" ("id" uuid not null default uuid_generate_v4(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "name" varchar(255) not null, constraint "boards_pkey" primary key ("id"));`,
    );

    this.addSql(
      `create table "board_gmail_accounts" ("id" uuid not null default uuid_generate_v4(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "board_id" uuid not null, "google_id" varchar(255) not null, "access_token_encrypted" text not null, "access_token_expires_at" timestamptz not null, "refresh_token_encrypted" text not null, constraint "board_gmail_accounts_pkey" primary key ("id"));`,
    );
    this.addSql(
      `alter table "board_gmail_accounts" add constraint "board_gmail_accounts_board_id_google_id_unique" unique ("board_id", "google_id");`,
    );

    this.addSql(
      `create table "board_members" ("id" uuid not null default uuid_generate_v4(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "board_id" uuid not null, "user_id" uuid not null, constraint "board_members_pkey" primary key ("id"));`,
    );
    this.addSql(`create index "board_members_user_id_index" on "board_members" ("user_id");`);
    this.addSql(
      `alter table "board_members" add constraint "board_members_board_id_user_id_unique" unique ("board_id", "user_id");`,
    );

    this.addSql(
      `alter table "board_gmail_accounts" add constraint "board_gmail_accounts_board_id_foreign" foreign key ("board_id") references "boards" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "board_members" add constraint "board_members_board_id_foreign" foreign key ("board_id") references "boards" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "board_members" add constraint "board_members_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "users" drop column "access_token_encrypted", drop column "access_token_expires_at", drop column "refresh_token_encrypted";`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "board_gmail_accounts" drop constraint "board_gmail_accounts_board_id_foreign";`);

    this.addSql(`alter table "board_members" drop constraint "board_members_board_id_foreign";`);

    this.addSql(`drop table if exists "boards" cascade;`);

    this.addSql(`drop table if exists "board_gmail_accounts" cascade;`);

    this.addSql(`drop table if exists "board_members" cascade;`);

    this.addSql(
      `alter table "users" add column "access_token_encrypted" text not null, add column "access_token_expires_at" timestamptz not null, add column "refresh_token_encrypted" text not null;`,
    );
  }
}
