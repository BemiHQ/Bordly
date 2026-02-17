import { Migration } from '@mikro-orm/migrations';

export class Migration20260210023533_add_email_drafts extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "email_drafts" ("id" uuid not null default uuid_generate_v4(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "board_card_id" uuid not null, "generated" boolean not null, "from" jsonb not null, "to" jsonb null, "cc" jsonb null, "bcc" jsonb null, "subject" varchar(255) null, "body_html" varchar(255) null, constraint "email_drafts_pkey" primary key ("id"));`,
    );
    this.addSql(
      `alter table "email_drafts" add constraint "email_drafts_board_card_id_unique" unique ("board_card_id");`,
    );

    this.addSql(
      `alter table "email_drafts" add constraint "email_drafts_board_card_id_foreign" foreign key ("board_card_id") references "board_cards" ("id") on update cascade;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "email_drafts" cascade;`);
  }
}
