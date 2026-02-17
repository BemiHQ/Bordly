import { Migration } from '@mikro-orm/migrations';

export class Migration20260127220847_add_emails extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "email_messages" ("id" uuid not null default uuid_generate_v4(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "gmail_account_id" uuid not null, "external_id" varchar(255) not null, "external_thread_id" varchar(255) not null, "external_created_at" timestamptz not null, "from" varchar(255) not null, "to" text[] null, "reply_to" varchar(255) null, "cc" text[] null, "bcc" text[] null, "labels" text[] not null, "subject" varchar(255) not null, "snippet" varchar(255) not null, "body_text" text null, "body_html" text null, constraint "email_messages_pkey" primary key ("id"));`,
    );
    this.addSql(`create index "email_messages_external_created_at_index" on "email_messages" ("external_created_at");`);
    this.addSql(`create index "email_messages_external_thread_id_index" on "email_messages" ("external_thread_id");`);
    this.addSql(
      `alter table "email_messages" add constraint "email_messages_gmail_account_id_external_id_unique" unique ("gmail_account_id", "external_id");`,
    );

    this.addSql(
      `create table "attachements" ("id" uuid not null default uuid_generate_v4(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "gmail_account_id" uuid not null, "email_message_id" uuid not null, "external_id" text not null, "filename" varchar(255) not null, "mime_type" varchar(255) not null, "size" int not null, constraint "attachements_pkey" primary key ("id"));`,
    );
    this.addSql(`create index "attachements_email_message_id_index" on "attachements" ("email_message_id");`);
    this.addSql(
      `alter table "attachements" add constraint "attachements_gmail_account_id_external_id_unique" unique ("gmail_account_id", "external_id");`,
    );

    this.addSql(
      `alter table "email_messages" add constraint "email_messages_gmail_account_id_foreign" foreign key ("gmail_account_id") references "gmail_accounts" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "attachements" add constraint "attachements_gmail_account_id_foreign" foreign key ("gmail_account_id") references "gmail_accounts" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "attachements" add constraint "attachements_email_message_id_foreign" foreign key ("email_message_id") references "email_messages" ("id") on update cascade;`,
    );

    this.addSql(`alter table "gmail_accounts" add column "email" varchar(255) not null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "attachements" drop constraint "attachements_email_message_id_foreign";`);

    this.addSql(`drop table if exists "email_messages" cascade;`);

    this.addSql(`drop table if exists "attachements" cascade;`);

    this.addSql(`alter table "gmail_accounts" drop column "email";`);
  }
}
