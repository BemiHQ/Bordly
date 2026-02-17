import { Collection, Entity, OneToMany, Property } from '@mikro-orm/postgresql';

import { BaseEntity } from '@/entities/base-entity';
import type { BoardAccount } from '@/entities/board-account';
import type { BoardColumn } from '@/entities/board-column';
import type { BoardInvite } from '@/entities/board-invite';
import type { BoardMember } from '@/entities/board-member';
import { slugify } from '@/utils/strings';

@Entity({ tableName: 'boards' })
export class Board extends BaseEntity {
  @OneToMany({ mappedBy: (boardAccount: BoardAccount) => boardAccount.board })
  boardAccounts = new Collection<BoardAccount>(this);
  @OneToMany({ mappedBy: (boardMember: BoardMember) => boardMember.board })
  boardMembers = new Collection<BoardMember>(this);
  @OneToMany({ mappedBy: (boardColumn: BoardColumn) => boardColumn.board })
  boardColumns = new Collection<BoardColumn>(this);
  @OneToMany({ mappedBy: (boardInvite: BoardInvite) => boardInvite.board })
  boardInvites = new Collection<BoardInvite>(this);

  @Property()
  name: string;

  constructor({ name }: { name: string }) {
    super();
    this.name = name;
    this.validate();
  }

  get initialized() {
    return this.boardColumns.length > 0;
  }

  get solo() {
    return this.boardMembers.filter((m) => !m.isAgent).length === 1;
  }

  setName(name: string) {
    this.name = name;
    this.validate();
  }

  toJson() {
    return {
      id: this.id,
      friendlyId: `${slugify(this.name)}-${this.id}`,
      name: this.name,
    };
  }

  private validate() {
    if (!this.name) throw new Error('Name is required');
  }
}
