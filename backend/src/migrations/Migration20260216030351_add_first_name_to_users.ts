import { Migration } from '@mikro-orm/migrations';

export class Migration20260216030351_add_first_name_to_users extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "users" add column "first_name" varchar(255) null;`);
    this.addSql(`alter table "users" rename column "name" to "full_name";`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "users" drop column "first_name";`);

    this.addSql(`alter table "users" rename column "full_name" to "name";`);
  }
}
