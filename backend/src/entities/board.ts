import { Collection, Entity, ManyToMany, OneToMany, Property } from '@mikro-orm/postgresql';

import { BaseEntity } from '@/entities/base-entity';
import type { BoardMember } from '@/entities/board-member';
import type { User } from '@/entities/user';

@Entity({ tableName: 'boards' })
export class Board extends BaseEntity {
  @OneToMany({ mappedBy: (boardMember: BoardMember) => boardMember.board })
  boardMembers = new Collection<BoardMember>(this);
  @ManyToMany({ mappedBy: (user: User) => user.boards })
  users = new Collection<User>(this);

  @Property()
  name: string;

  constructor({ name }: { name: string }) {
    super();
    this.name = name;
    this.validate();
  }

  toJson() {
    return {
      id: this.id,
      name: this.name,
    };
  }

  private validate() {
    if (!this.name) throw new Error('Name is required');
  }
}
