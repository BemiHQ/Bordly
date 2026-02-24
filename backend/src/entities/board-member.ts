import {
  Collection,
  Embeddable,
  Embedded,
  Entity,
  Enum,
  Index,
  type Loaded,
  ManyToOne,
  OneToMany,
  Property,
  Unique,
} from '@mikro-orm/postgresql';

import { BaseEntity } from '@/entities/base-entity';
import type { Board } from '@/entities/board';
import type { BoardCard } from '@/entities/board-card';
import { User } from '@/entities/user';
import { BoardMemberRole, MemoryFormality } from '@/utils/shared';

export { BoardMemberRole as Role };

export interface BoardMember {
  loadedBoard: Board;
  loadedUser: User;
}

@Embeddable()
export class BoardMemberMemory {
  @Property()
  greeting?: string;
  @Property()
  opener?: string;
  @Property()
  signature?: string;
  @Enum(() => MemoryFormality)
  formality?: MemoryFormality;
  @Property()
  meetingLink?: string;
}

@Entity({ tableName: 'board_members' })
@Unique({ properties: ['board', 'user'] })
@Index({ properties: ['user'] })
export class BoardMember extends BaseEntity {
  @ManyToOne()
  board: Board;
  @ManyToOne()
  user: User;

  @OneToMany({ mappedBy: (boardCard: BoardCard) => boardCard.assignedBoardMember })
  assignedBoardCards = new Collection<BoardCard>(this);

  @Enum(() => BoardMemberRole)
  role: BoardMemberRole;

  @Embedded(() => BoardMemberMemory, { object: true, lazy: true })
  memory?: BoardMemberMemory;

  constructor({ board, user, role }: { board: Board; user: User; role: BoardMemberRole }) {
    super();
    this.board = board;
    this.user = user;
    this.role = role;
    this.validate();
  }

  setMemory(memory: BoardMemberMemory) {
    this.memory = memory;
  }

  setRole(role: BoardMemberRole) {
    this.role = role;
    this.validate();
  }

  get isAgent() {
    return this.role === BoardMemberRole.AGENT;
  }

  static toJson(boardMember: Loaded<BoardMember, 'user.gmailAccount.senderEmailAddresses'>) {
    const user = boardMember.loadedUser;

    return {
      id: boardMember.id,
      user: User.toJson(user),
      senderEmails: user.isBordly ? [] : user.gmailAccount.senderEmailAddresses.map((a) => a.email),
      role: boardMember.role,
      isAgent: boardMember.isAgent,
    };
  }

  static toText(boardMember: Loaded<BoardMember, 'user' | 'memory'>) {
    const user = boardMember.loadedUser;
    const { memory } = boardMember;
    const items = [
      `- ID: ${boardMember.id}`,
      `- User: ${User.toStr(user)}`,
      `- Role: ${boardMember.role}`,
      `- Preferences:`,
      memory?.greeting && `  - Greeting: ${memory.greeting}`,
      memory?.opener && `  - Opener: ${memory.opener}`,
      memory?.formality && `  - Formality: ${memory.formality}`,
      memory?.meetingLink && `  - Meeting Link: ${memory.meetingLink}`,
      memory?.signature &&
        `  - Signature:
\`\`\`
${memory.signature}
\`\`\`
`,
    ];

    return `Board Member:
${items.filter(Boolean).join('\n')}`;
  }

  static toStr(boardMember: Loaded<BoardMember, 'user'>) {
    return `${boardMember.loadedUser.fullName} (${boardMember.loadedUser.email}) - ${boardMember.role}`;
  }

  private validate() {
    if (!this.board) throw new Error('Board is required');
    if (!this.user) throw new Error('User is required');
    if (!this.role) throw new Error('Role is required');
    if (!Object.values(BoardMemberRole).includes(this.role)) throw new Error('Invalid role');
  }
}
