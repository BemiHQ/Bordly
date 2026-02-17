import { Migration } from '@mikro-orm/migrations';

export class Migration20260129155211_add_domains extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "domains" ("id" uuid not null default uuid_generate_v4(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "name" varchar(255) not null, "icon_url" varchar(255) null, constraint "domains_pkey" primary key ("id"));`,
    );
    this.addSql(`alter table "domains" add constraint "domains_name_unique" unique ("name");`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "domains" cascade;`);
  }
}
