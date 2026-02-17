import { Migration } from '@mikro-orm/migrations';

export class Migration20260127014858_add_board_invites extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "board_invites" ("id" uuid not null default uuid_generate_v4(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "board_id" uuid not null, "invited_by_id" uuid not null, "email" varchar(255) not null, "state" text check ("state" in ('PENDING', 'ACCEPTED', 'DECLINED')) not null, constraint "board_invites_pkey" primary key ("id"));`);
    this.addSql(`create index "board_invites_email_index" on "board_invites" ("email");`);
    this.addSql(`alter table "board_invites" add constraint "board_invites_board_id_email_unique" unique ("board_id", "email");`);

    this.addSql(`alter table "board_invites" add constraint "board_invites_board_id_foreign" foreign key ("board_id") references "boards" ("id") on update cascade;`);
    this.addSql(`alter table "board_invites" add constraint "board_invites_invited_by_id_foreign" foreign key ("invited_by_id") references "users" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "board_invites" cascade;`);
  }

}
