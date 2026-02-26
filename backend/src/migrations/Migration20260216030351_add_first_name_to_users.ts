import { Migration } from '@mikro-orm/migrations';

export class Migration20260216030351_add_first_name_to_users extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "users" add column "first_name" varchar(255) null;`);
    this.addSql(`alter table "users" rename column "name" to "full_name";`);

    this.addSql(`
      insert into "users" (id, email, full_name, first_name, photo_url, created_at, updated_at)
      select '00000000-0000-0000-0000-000000000000', 'no-reply@bordly.ai', 'Bordly', 'Bordly', '/images/apple-touch-icon.png', now(), now()
      where not exists (select 1 from "users" where id = '00000000-0000-0000-0000-000000000000');
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "users" drop column "first_name";`);

    this.addSql(`alter table "users" rename column "full_name" to "name";`);
  }
}
