import { createFileRoute, redirect } from '@tanstack/react-router';
import type { inferRouterOutputs } from '@trpc/server';
import type { TRPCRouter } from 'bordly-backend/trpc-router';
import { Navbar } from '@/components/navbar';
import { Card } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import { unique } from '@/utils/lists';
import { extractUuid, humanizeEmail } from '@/utils/strings';
import { ROUTES } from '@/utils/urls';

const MAX_BOARD_COLUMN_POSITION = 1_000; // System Spam and Trash

type Board = inferRouterOutputs<TRPCRouter>['board']['getBoard'];
type BoardColumn = Board['boardColumns'][number];
type BoardCard = Board['boardCards'][number];
type EmailMessagesByThreadId = Board['emailMessagesByThreadId'];
type EmailMessage = EmailMessagesByThreadId[number][number];
type GmailAccount = Board['gmailAccounts'][number];

export const Route = createFileRoute('/boards/$boardId')({
  component: Home,
  loader: async ({ context, params }) => {
    const currentUser = await context.queryClient.ensureQueryData(context.trpc.user.getCurrentUser.queryOptions());
    if (!currentUser) {
      throw redirect({ to: ROUTES.AUTH });
    }
    if (currentUser.boards.length === 0) {
      throw redirect({ to: ROUTES.WELCOME });
    }

    const board = await context.queryClient.ensureQueryData(
      context.trpc.board.getBoard.queryOptions({ boardId: extractUuid(params.boardId) }),
    );
    return { currentUser, board };
  },
});

const EmptyState = () => {
  const { currentUser } = Route.useLoaderData();

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar currentUser={currentUser} />
      <Empty className="w-full">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Spinner />
          </EmptyMedia>
          <EmptyTitle>Importing your emails...</EmptyTitle>
          <EmptyDescription>Please wait while we set up your board. This may take a few minutes.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
};

const BoardNavbar = ({ board }: { board: Board }) => {
  return (
    <div className="border-b bg-background px-6 py-3">
      <h1 className="font-semibold">{board.board.name}</h1>
    </div>
  );
};

const BoardColumn = ({ boardColumn, children }: { boardColumn: BoardColumn; children: React.ReactNode }) => {
  if (boardColumn.position > MAX_BOARD_COLUMN_POSITION) return null;

  return (
    <div className="flex w-68 h-fit flex-col gap-3 rounded-lg bg-primary-foreground p-3 border border-border">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold">{boardColumn.name}</h2>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
};

const BoardCard = ({
  boardCard: _boardCard,
  gmailAccounts,
  emailMessages,
}: {
  boardCard: BoardCard;
  gmailAccounts: GmailAccount[];
  emailMessages: EmailMessage[];
}) => {
  const title = emailMessages.find((msg) => msg.subject)?.subject || 'No Subject';

  // Extract names from First Name <email> if possible
  const participants = unique(
    emailMessages
      .flatMap((msg) =>
        msg.isSent
          ? [...(msg.to || []), ...(msg.cc || []), ...(msg.bcc || [])]
          : [msg.from, ...(msg.to || []), ...(msg.cc || [])],
      )
      .filter((email) => !gmailAccounts.some((account) => email.includes(account.email)))
      .map(humanizeEmail)
      .filter(Boolean),
  );

  return (
    <Card className="cursor-pointer p-3 transition-shadow hover:bg-background rounded-lg shadow-xs flex flex-col gap-1">
      <div className="text-sm truncate">
        <span className="font-semibold">{participants[0]}</span>
        {participants.length > 1 && <span className="text-muted-foreground">, {participants.slice(1).join(', ')}</span>}
      </div>
      <div className="text-xs truncate">{title}</div>
    </Card>
  );
};

function Home() {
  const { currentUser, board } = Route.useLoaderData();

  if (board.boardColumns.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar currentUser={currentUser} />
      <BoardNavbar board={board} />
      <div className="flex overflow-x-auto p-3 gap-3">
        {board.boardColumns.map((boardColumn) => (
          <BoardColumn key={boardColumn.id} boardColumn={boardColumn}>
            {board.boardCards
              .filter((card) => card.boardColumnId === boardColumn.id)
              .map((boardCard) => (
                <BoardCard
                  key={boardCard.id}
                  boardCard={boardCard}
                  gmailAccounts={board.gmailAccounts}
                  emailMessages={board.emailMessagesByThreadId[boardCard.externalThreadId]}
                />
              ))}
          </BoardColumn>
        ))}
      </div>
    </div>
  );
}
