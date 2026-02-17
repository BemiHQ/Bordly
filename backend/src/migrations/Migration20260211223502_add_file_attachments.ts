import { Migration } from '@mikro-orm/migrations';

export class Migration20260211223502_add_file_attachments extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "file_attachments" ("id" uuid not null default uuid_generate_v4(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "email_draft_id" uuid not null, "s3key" text not null, "filename" varchar(255) not null, "mime_type" varchar(255) not null, "size" int not null, constraint "file_attachments_pkey" primary key ("id"));`,
    );
    this.addSql(`alter table "file_attachments" add constraint "file_attachments_s3key_unique" unique ("s3key");`);
    this.addSql(
      `alter table "file_attachments" add constraint "file_attachments_email_draft_id_filename_unique" unique ("email_draft_id", "filename");`,
    );

    this.addSql(
      `alter table "file_attachments" add constraint "file_attachments_email_draft_id_foreign" foreign key ("email_draft_id") references "email_drafts" ("id") on update cascade;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "file_attachments" cascade;`);
  }
}
