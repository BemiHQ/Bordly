import { Migration } from '@mikro-orm/migrations';

export class Migration20260130223046_squash_migrations extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create extension if not exists "uuid-ossp";`);
    this.addSql(
      `create table "boards" ("id" uuid not null default uuid_generate_v4(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "name" varchar(255) not null, constraint "boards_pkey" primary key ("id"));`,
    );

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
      `create table "domains" ("id" uuid not null default uuid_generate_v4(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "name" varchar(255) not null, "icon_url" varchar(255) null, constraint "domains_pkey" primary key ("id"));`,
    );
    this.addSql(`alter table "domains" add constraint "domains_name_unique" unique ("name");`);

    this.addSql(
      `create table "users" ("id" uuid not null default uuid_generate_v4(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "email" varchar(255) not null, "name" varchar(255) not null, "photo_url" text not null, "last_session_at" timestamptz null, constraint "users_pkey" primary key ("id"));`,
    );
    this.addSql(`alter table "users" add constraint "users_email_unique" unique ("email");`);

    this.addSql(
      `create table "gmail_accounts" ("id" uuid not null default uuid_generate_v4(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "board_id" uuid null, "user_id" uuid not null, "name" varchar(255) not null, "email" varchar(255) not null, "google_id" varchar(255) not null, "access_token_encrypted" text not null, "access_token_expires_at" timestamptz not null, "refresh_token_encrypted" text not null, constraint "gmail_accounts_pkey" primary key ("id"));`,
    );
    this.addSql(`create index "gmail_accounts_user_id_index" on "gmail_accounts" ("user_id");`);
    this.addSql(`alter table "gmail_accounts" add constraint "gmail_accounts_email_unique" unique ("email");`);
    this.addSql(`alter table "gmail_accounts" add constraint "gmail_accounts_google_id_unique" unique ("google_id");`);

    this.addSql(
      `create table "email_messages" ("id" uuid not null default uuid_generate_v4(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "gmail_account_id" uuid not null, "external_id" varchar(255) not null, "external_thread_id" varchar(255) not null, "external_created_at" timestamptz not null, "from" jsonb not null, "to" jsonb null, "reply_to" jsonb null, "cc" jsonb null, "bcc" jsonb null, "sent" boolean not null, "labels" text[] not null, "subject" varchar(255) not null, "snippet" varchar(255) not null, "body_text" text null, "body_html" text null, constraint "email_messages_pkey" primary key ("id"));`,
    );
    this.addSql(`create index "email_messages_external_created_at_index" on "email_messages" ("external_created_at");`);
    this.addSql(`create index "email_messages_external_thread_id_index" on "email_messages" ("external_thread_id");`);
    this.addSql(
      `alter table "email_messages" add constraint "email_messages_gmail_account_id_external_id_unique" unique ("gmail_account_id", "external_id");`,
    );

    this.addSql(
      `create table "board_cards" ("id" uuid not null default uuid_generate_v4(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "gmail_account_id" uuid not null, "board_column_id" uuid not null, "domain_id" uuid not null, "external_thread_id" varchar(255) not null, "state" text check ("state" in ('INBOX', 'ARCHIVED', 'SPAM', 'TRASHED')) not null, "subject" varchar(255) not null, "snippet" varchar(255) not null, "participants" jsonb not null, "last_event_at" timestamptz not null, "unread_email_message_ids" jsonb null, "pinned_position" int null, "moved_to_trash_at" timestamptz null, constraint "board_cards_pkey" primary key ("id"));`,
    );
    this.addSql(`create index "board_cards_last_event_at_index" on "board_cards" ("last_event_at");`);
    this.addSql(`create index "board_cards_gmail_account_id_index" on "board_cards" ("gmail_account_id");`);
    this.addSql(
      `alter table "board_cards" add constraint "board_cards_board_column_id_pinned_position_unique" unique ("board_column_id", "pinned_position");`,
    );

    this.addSql(
      `create table "attachements" ("id" uuid not null default uuid_generate_v4(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "gmail_account_id" uuid not null, "email_message_id" uuid not null, "external_id" text not null, "filename" varchar(255) not null, "mime_type" varchar(255) not null, "size" int not null, constraint "attachements_pkey" primary key ("id"));`,
    );
    this.addSql(`create index "attachements_email_message_id_index" on "attachements" ("email_message_id");`);
    this.addSql(
      `alter table "attachements" add constraint "attachements_gmail_account_id_external_id_unique" unique ("gmail_account_id", "external_id");`,
    );

    this.addSql(
      `create table "board_members" ("id" uuid not null default uuid_generate_v4(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_id" uuid not null, "role" text check ("role" in ('ADMIN')) not null, "board_id" uuid not null, constraint "board_members_pkey" primary key ("id"));`,
    );
    this.addSql(`create index "board_members_user_id_index" on "board_members" ("user_id");`);
    this.addSql(
      `alter table "board_members" add constraint "board_members_board_id_user_id_unique" unique ("board_id", "user_id");`,
    );

    this.addSql(
      `create table "board_invites" ("id" uuid not null default uuid_generate_v4(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "board_id" uuid not null, "invited_by_id" uuid not null, "email" varchar(255) not null, "state" text check ("state" in ('PENDING', 'ACCEPTED', 'DECLINED')) not null, constraint "board_invites_pkey" primary key ("id"));`,
    );
    this.addSql(`create index "board_invites_email_index" on "board_invites" ("email");`);
    this.addSql(
      `alter table "board_invites" add constraint "board_invites_board_id_email_unique" unique ("board_id", "email");`,
    );

    this.addSql(
      `alter table "board_columns" add constraint "board_columns_board_id_foreign" foreign key ("board_id") references "boards" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "gmail_accounts" add constraint "gmail_accounts_board_id_foreign" foreign key ("board_id") references "boards" ("id") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "gmail_accounts" add constraint "gmail_accounts_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "email_messages" add constraint "email_messages_gmail_account_id_foreign" foreign key ("gmail_account_id") references "gmail_accounts" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "board_cards" add constraint "board_cards_gmail_account_id_foreign" foreign key ("gmail_account_id") references "gmail_accounts" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "board_cards" add constraint "board_cards_board_column_id_foreign" foreign key ("board_column_id") references "board_columns" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "board_cards" add constraint "board_cards_domain_id_foreign" foreign key ("domain_id") references "domains" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "attachements" add constraint "attachements_gmail_account_id_foreign" foreign key ("gmail_account_id") references "gmail_accounts" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "attachements" add constraint "attachements_email_message_id_foreign" foreign key ("email_message_id") references "email_messages" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "board_members" add constraint "board_members_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "board_members" add constraint "board_members_board_id_foreign" foreign key ("board_id") references "boards" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "board_invites" add constraint "board_invites_board_id_foreign" foreign key ("board_id") references "boards" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "board_invites" add constraint "board_invites_invited_by_id_foreign" foreign key ("invited_by_id") references "users" ("id") on update cascade;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "board_columns" drop constraint "board_columns_board_id_foreign";`);

    this.addSql(`alter table "gmail_accounts" drop constraint "gmail_accounts_board_id_foreign";`);

    this.addSql(`alter table "board_members" drop constraint "board_members_board_id_foreign";`);

    this.addSql(`alter table "board_invites" drop constraint "board_invites_board_id_foreign";`);

    this.addSql(`alter table "board_cards" drop constraint "board_cards_board_column_id_foreign";`);

    this.addSql(`alter table "board_cards" drop constraint "board_cards_domain_id_foreign";`);

    this.addSql(`alter table "gmail_accounts" drop constraint "gmail_accounts_user_id_foreign";`);

    this.addSql(`alter table "board_members" drop constraint "board_members_user_id_foreign";`);

    this.addSql(`alter table "board_invites" drop constraint "board_invites_invited_by_id_foreign";`);

    this.addSql(`alter table "email_messages" drop constraint "email_messages_gmail_account_id_foreign";`);

    this.addSql(`alter table "board_cards" drop constraint "board_cards_gmail_account_id_foreign";`);

    this.addSql(`alter table "attachements" drop constraint "attachements_gmail_account_id_foreign";`);

    this.addSql(`alter table "attachements" drop constraint "attachements_email_message_id_foreign";`);

    this.addSql(`drop table if exists "boards" cascade;`);

    this.addSql(`drop table if exists "board_columns" cascade;`);

    this.addSql(`drop table if exists "domains" cascade;`);

    this.addSql(`drop table if exists "users" cascade;`);

    this.addSql(`drop table if exists "gmail_accounts" cascade;`);

    this.addSql(`drop table if exists "email_messages" cascade;`);

    this.addSql(`drop table if exists "board_cards" cascade;`);

    this.addSql(`drop table if exists "attachements" cascade;`);

    this.addSql(`drop table if exists "board_members" cascade;`);

    this.addSql(`drop table if exists "board_invites" cascade;`);
  }
}
