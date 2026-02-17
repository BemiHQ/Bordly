import { Migration } from '@mikro-orm/migrations';

export class Migration20260211174243_add_message_id_to_email_messages extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "email_messages" add column "message_id" varchar(255) null, add column "references" text null;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "email_messages" drop column "message_id", drop column "references";`);
  }
}
