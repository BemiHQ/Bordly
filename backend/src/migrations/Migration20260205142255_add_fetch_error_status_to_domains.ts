import { Migration } from '@mikro-orm/migrations';

export class Migration20260205142255_add_fetch_error_status_to_domains extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "domains" add column "fetch_error_status" int null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "domains" drop column "fetch_error_status";`);
  }
}
