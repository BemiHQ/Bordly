import { createTRPCRouter } from '@/trpc-config';

import { BOARD_ROUTES } from '@/trpc-routes/board.routes';
import { BOARD_ACCOUNT_ROUTES } from '@/trpc-routes/board-account.routes';
import { BOARD_CARD_ROUTES } from '@/trpc-routes/board-card.routes';
import { BOARD_COLUMN_ROUTES } from '@/trpc-routes/board-column.routes';
import { BOARD_INVITE_ROUTES } from '@/trpc-routes/board-invite.routes';
import { BOARD_MEMBER_ROUTES } from '@/trpc-routes/board-member.routes';
import { COMMENT_ROUTES } from '@/trpc-routes/comment.routes';
import { EMAIL_DRAFT_ROUTES } from '@/trpc-routes/email-draft.routes';
import { SENDER_EMAIL_ADDRESS_ROUTES } from '@/trpc-routes/sender-email-address.routes';
import { USER_ROUTES } from '@/trpc-routes/user.routes';

const TRPC_ROUTES = {
  ...USER_ROUTES,
  ...BOARD_ROUTES,
  ...BOARD_ACCOUNT_ROUTES,
  ...BOARD_COLUMN_ROUTES,
  ...BOARD_CARD_ROUTES,
  ...BOARD_INVITE_ROUTES,
  ...BOARD_MEMBER_ROUTES,
  ...COMMENT_ROUTES,
  ...SENDER_EMAIL_ADDRESS_ROUTES,
  ...EMAIL_DRAFT_ROUTES,
};

export const trpcRouter = createTRPCRouter(TRPC_ROUTES);
export type TRPCRouter = typeof trpcRouter;
