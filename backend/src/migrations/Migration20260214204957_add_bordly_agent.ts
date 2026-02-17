import { Migration } from '@mikro-orm/migrations';

export class Migration20260214204957_add_bordly_agent extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "board_members" drop constraint if exists "board_members_role_check";`);

    this.addSql(`alter table "board_invites" drop constraint if exists "board_invites_role_check";`);

    this.addSql(
      `alter table "board_members" add constraint "board_members_role_check" check("role" in ('ADMIN', 'MEMBER', 'AGENT'));`,
    );

    this.addSql(
      `alter table "board_cards" add column "assigned_board_member_id" uuid null, add column "participant_user_ids" text[] null;`,
    );
    this.addSql(
      `alter table "board_cards" add constraint "board_cards_assigned_board_member_id_foreign" foreign key ("assigned_board_member_id") references "board_members" ("id") on update cascade on delete set null;`,
    );
    this.addSql(
      `create index "board_cards_assigned_board_member_id_index" on "board_cards" ("assigned_board_member_id");`,
    );

    this.addSql(
      `alter table "board_invites" add constraint "board_invites_role_check" check("role" in ('ADMIN', 'MEMBER', 'AGENT'));`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "board_cards" drop constraint "board_cards_assigned_board_member_id_foreign";`);

    this.addSql(`alter table "board_members" drop constraint if exists "board_members_role_check";`);

    this.addSql(`alter table "board_invites" drop constraint if exists "board_invites_role_check";`);

    this.addSql(`drop index "board_cards_assigned_board_member_id_index";`);
    this.addSql(
      `alter table "board_cards" drop column "assigned_board_member_id", drop column "participant_user_ids";`,
    );

    this.addSql(
      `alter table "board_members" add constraint "board_members_role_check" check("role" in ('ADMIN', 'MEMBER'));`,
    );

    this.addSql(
      `alter table "board_invites" add constraint "board_invites_role_check" check("role" in ('ADMIN', 'MEMBER'));`,
    );
  }
}
