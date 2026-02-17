import { Migration } from '@mikro-orm/migrations';

export class Migration20260127001610_gmail_accounts extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "gmail_accounts" ("id" uuid not null default uuid_generate_v4(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "board_id" uuid null, "user_id" uuid not null, "google_id" varchar(255) not null, "access_token_encrypted" text not null, "access_token_expires_at" timestamptz not null, "refresh_token_encrypted" text not null, constraint "gmail_accounts_pkey" primary key ("id"));`,
    );
    this.addSql(`create index "gmail_accounts_user_id_index" on "gmail_accounts" ("user_id");`);
    this.addSql(`alter table "gmail_accounts" add constraint "gmail_accounts_google_id_unique" unique ("google_id");`);

    this.addSql(
      `alter table "gmail_accounts" add constraint "gmail_accounts_board_id_foreign" foreign key ("board_id") references "boards" ("id") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "gmail_accounts" add constraint "gmail_accounts_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade;`,
    );

    this.addSql(`drop table if exists "board_gmail_accounts" cascade;`);

    this.addSql(`alter table "users" drop constraint "users_google_id_unique";`);
    this.addSql(`alter table "users" drop column "google_id";`);

    this.addSql(`alter table "board_members" add column "role" text check ("role" in ('ADMIN')) not null;`);
  }

  override async down(): Promise<void> {
    this.addSql(
      `create table "board_gmail_accounts" ("id" uuid not null default uuid_generate_v4(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "board_id" uuid not null, "google_id" varchar(255) not null, "access_token_encrypted" text not null, "access_token_expires_at" timestamptz not null, "refresh_token_encrypted" text not null, constraint "board_gmail_accounts_pkey" primary key ("id"));`,
    );
    this.addSql(
      `alter table "board_gmail_accounts" add constraint "board_gmail_accounts_board_id_google_id_unique" unique ("board_id", "google_id");`,
    );

    this.addSql(
      `alter table "board_gmail_accounts" add constraint "board_gmail_accounts_board_id_foreign" foreign key ("board_id") references "boards" ("id") on update cascade;`,
    );

    this.addSql(`drop table if exists "gmail_accounts" cascade;`);

    this.addSql(`alter table "users" add column "google_id" varchar(255) not null;`);
    this.addSql(`alter table "users" add constraint "users_google_id_unique" unique ("google_id");`);

    this.addSql(`alter table "board_members" drop column "role";`);
  }
}
