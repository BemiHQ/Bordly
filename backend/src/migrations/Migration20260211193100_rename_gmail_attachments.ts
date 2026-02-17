import { Migration } from '@mikro-orm/migrations';

export class Migration20260211193100_rename_gmail_attachments extends Migration {
  override async up(): Promise<void> {
    this.addSql(`ALTER TABLE "attachements" RENAME TO "gmail_attachments";`);
  }

  override async down(): Promise<void> {
    this.addSql(`ALTER TABLE "gmail_attachments" RENAME TO "attachements";`);
  }
}
