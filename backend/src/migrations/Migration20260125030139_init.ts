import { Migration } from '@mikro-orm/migrations';

export class Migration20260125030139_init extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create extension if not exists "uuid-ossp";`);
    this.addSql(
      `create table "users" ("id" uuid not null default uuid_generate_v4(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "email" varchar(255) not null, "name" varchar(255) not null, "photo_url" text not null, "last_session_at" timestamptz null, "google_id" varchar(255) not null, "access_token_encrypted" text not null, "access_token_expires_at" timestamptz not null, "refresh_token_encrypted" text not null, constraint "users_pkey" primary key ("id"));`,
    );
    this.addSql(`alter table "users" add constraint "users_google_id_unique" unique ("google_id");`);
    this.addSql(`alter table "users" add constraint "users_email_unique" unique ("email");`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "users" cascade;`);
  }
}
