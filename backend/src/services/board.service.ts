import { Board } from '@/entities/board';
import { BoardMember } from '@/entities/board-member';
import type { User } from '@/entities/user';
import { orm } from '@/utils/orm';

export class BoardService {
  static async create({ name, user }: { name: string; user: User }) {
    const board = new Board({ name });
    const boardMember = new BoardMember({ board, user });
    await orm.em.persist([board, boardMember]).flush();
    return board;
  }
}
