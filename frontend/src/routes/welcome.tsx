import { useMutation } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { H1 } from '@/components/ui/h1';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';

import { useTRPC } from '@/trpc';
import { ROUTES } from '@/utils/urls';

export const Route = createFileRoute('/welcome')({
  component: Welcome,
  loader: async ({ context }) => {
    const currentUser = await context.queryClient.ensureQueryData(context.trpc.user.getCurrentUser.queryOptions());
    if (!currentUser) {
      throw redirect({ to: ROUTES.AUTH });
    }
    if (currentUser.boards.length > 0) {
      throw redirect({ to: ROUTES.HOME });
    }
    return { currentUser };
  },
});

const NewBoard = ({ setBoardId }: { setBoardId: (boardId: string) => void }) => {
  const { currentUser } = Route.useLoaderData();
  const [boardName, setBoardName] = useState(`${currentUser.name.split(' ')[0]}'s Board`);
  const trpc = useTRPC();
  const createBoardMutation = useMutation(
    trpc.board.createBoard.mutationOptions({
      onSuccess: (data) => setBoardId(data.id),
    }),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createBoardMutation.mutate({ name: boardName });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 max-w-md mx-auto px-4">
      <H1>Create your first board</H1>

      <span className="text-muted-foreground text-center">
        Boards are sharable spaces where you and others can collaborate on emails.
      </span>

      <form onSubmit={handleSubmit} className="w-full">
        <Card>
          <CardContent>
            <Field>
              <FieldLabel htmlFor="board-name">Board Name</FieldLabel>
              <Input
                id="board-name"
                placeholder="My Board"
                value={boardName}
                onChange={(e) => setBoardName(e.target.value)}
              />
            </Field>
          </CardContent>
          <CardFooter className="justify-center">
            <Button
              type="submit"
              size="lg"
              disabled={!boardName.trim() || createBoardMutation.isPending}
              className="flex items-center gap-2"
            >
              {createBoardMutation.isPending ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Creating...
                </>
              ) : (
                'Create Board'
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
};

const InviteMembers = ({ boardId }: { boardId: string }) => {
  const [inviteEmails, setInviteEmails] = useState('');
  const trpc = useTRPC();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 max-w-md mx-auto px-4">
      <H1>Invite your team</H1>

      <span className="text-muted-foreground text-center">
        Collaborate with your team by inviting members to your board.
      </span>

      <form onSubmit={handleSubmit} className="w-full">
        <Card>
          <CardContent>
            <Field>
              <FieldLabel htmlFor="invite-emails">Board Name</FieldLabel>
              <Textarea
                id="invite-emails"
                placeholder="email@example.com, email2@example.com, ..."
                value={inviteEmails}
                onChange={(e) => setInviteEmails(e.target.value)}
              />
            </Field>
          </CardContent>
          <CardFooter className="justify-center">
            <Button
              type="submit"
              size="lg"
              variant="contrast"
              disabled={!boardName.trim() || createBoardMutation.isPending}
              className="flex items-center gap-2"
            >
              {createBoardMutation.isPending ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Creating...
                </>
              ) : (
                'Create Board'
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
};

function Welcome() {
  const [boardId, setBoardId] = useState<string>();

  if (!boardId) {
    return <NewBoard setBoardId={setBoardId} />;
  }

  return <InviteMembers boardId={boardId} />;
}
