import { SiGithub, SiX } from '@icons-pack/react-simple-icons';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ERRORS } from 'bordly-backend/utils/shared';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { H1 } from '@/components/ui/h1';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { ensureLoggedIn } from '@/loaders/authentication';
import { API_ENDPOINTS, ROUTES } from '@/utils/urls';

export const Route = createFileRoute('/welcome')({
  component: Welcome,
  loader: ensureLoggedIn(ROUTES.WELCOME),
});

const NewBoard = ({ setBoardId }: { setBoardId: (boardId: string) => void }) => {
  const { trpc, queryClient } = Route.useRouteContext();
  const { currentUser } = Route.useLoaderData();
  const [boardName, setBoardName] = useState(`${currentUser.firstName}'s Board`);
  const [error, setError] = useState<string | undefined>();
  const createBoardMutation = useMutation(
    trpc.board.createFirstBoard.mutationOptions({
      onSuccess: async ({ board, error }) => {
        queryClient.removeQueries({ queryKey: trpc.user.getCurrentUser.queryKey(), exact: true });
        if (error) {
          setError(error);
        } else if (board) {
          setBoardId(board.id);
        }
      },
      onError: () => toast.error('Failed to create board. Please try again.', { position: 'top-center' }),
    }),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createBoardMutation.mutate({ name: boardName });
  };

  if (error === ERRORS.NO_GMAIL_ACCESS) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center max-w-4xl mx-auto px-4">
        <H1 className="mb-1">Gmail Access Required</H1>
        <span className="text-muted-foreground text-center">
          Please grant access to Gmail to continue using Bordly.
        </span>

        <img
          src="/images/google-oauth-gmail.png"
          alt="Gmail OAuth Access"
          className="w-full rounded-3xl shadow-md my-6"
        />

        <Button size="lg" asChild>
          <a href={API_ENDPOINTS.AUTH_GOOGLE}>Re-authenticate with Google</a>
        </Button>
      </div>
    );
  }

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
                'Create board'
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
};

const InviteMembers = ({
  boardId,
  setFinishedInviting,
}: {
  boardId: string;
  setFinishedInviting: (finished: boolean) => void;
}) => {
  const { trpc } = Route.useRouteContext();
  const [emails, setEmails] = useState('');
  const createInvitesMutation = useMutation(
    trpc.boardInvite.createMemberBoardInvites.mutationOptions({
      onSuccess: () => setFinishedInviting(true),
      onError: () => toast.error('Failed to send invites. Please try again.', { position: 'top-center' }),
    }),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createInvitesMutation.mutate({
      boardId,
      emails: emails
        .split(',')
        .map((email) => email.trim())
        .filter((email) => email),
    });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 max-w-lg mx-auto px-4">
      <H1>Invite your team</H1>

      <span className="text-muted-foreground text-center">
        Collaborate with your team by inviting members to your board.
      </span>

      <form onSubmit={handleSubmit} className="w-full">
        <Card>
          <CardContent>
            <Field>
              <FieldLabel htmlFor="invite-emails">Email Addresses</FieldLabel>
              <Textarea
                id="invite-emails"
                placeholder="email@example.com, email2@example.com, ..."
                className="min-h-16"
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
              />
            </Field>
          </CardContent>
          <CardFooter className="justify-center">
            <Button
              type="submit"
              size="lg"
              disabled={!emails.trim() || createInvitesMutation.isPending}
              className="flex items-center gap-2"
            >
              {createInvitesMutation.isPending ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Sending...
                </>
              ) : (
                'Send invites'
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>

      <Button variant="link" onClick={() => setFinishedInviting(true)}>
        Skip for now
      </Button>
    </div>
  );
};

const FinalStep = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 max-w-lg mx-auto px-4">
      <H1>You&apos;re all set</H1>

      <span className="text-muted-foreground text-center">
        Bordly is constantly evolving. Subscribe to stay updated with the latest features.
      </span>

      <Card className="w-full mb-2">
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-row justify-between items-center gap-4">
            <div className="text-sm font-semibold">Follow us on LinkedIn</div>
            <Button variant="outline" asChild>
              <a href="https://twitter.com/bordlyapp" target="_blank" rel="noopener noreferrer">
                <svg
                  className="size-4 h-6 w-6"
                  fill="#000000"
                  viewBox="-5.5 0 32 32"
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M0 8.219v15.563c0 1.469 1.156 2.625 2.625 2.625h15.563c0.719 0 1.406-0.344 1.844-0.781 0.469-0.469 0.781-1.063 0.781-1.844v-15.563c0-1.469-1.156-2.625-2.625-2.625h-15.563c-0.781 0-1.375 0.313-1.844 0.781-0.438 0.438-0.781 1.125-0.781 1.844zM2.813 10.281c0-1 0.813-1.875 1.813-1.875 1.031 0 1.875 0.875 1.875 1.875 0 1.031-0.844 1.844-1.875 1.844-1 0-1.813-0.813-1.813-1.844zM7.844 23.125v-9.531c0-0.219 0.219-0.406 0.375-0.406h2.656c0.375 0 0.375 0.438 0.375 0.719 0.75-0.75 1.719-0.938 2.719-0.938 2.438 0 4 1.156 4 3.719v6.438c0 0.219-0.188 0.406-0.375 0.406h-2.75c-0.219 0-0.375-0.219-0.375-0.406v-5.813c0-0.969-0.281-1.5-1.375-1.5-1.375 0-1.719 0.906-1.719 2.125v5.188c0 0.219-0.219 0.406-0.438 0.406h-2.719c-0.156 0-0.375-0.219-0.375-0.406zM2.875 23.125v-9.531c0-0.219 0.219-0.406 0.375-0.406h2.719c0.25 0 0.406 0.156 0.406 0.406v9.531c0 0.219-0.188 0.406-0.406 0.406h-2.719c-0.188 0-0.375-0.219-0.375-0.406z"></path>
                </svg>
                Bordly
              </a>
            </Button>
          </div>
          <div className="flex flex-row justify-between items-center gap-4">
            <div className="text-sm font-semibold">Follow us on X</div>
            <Button variant="outline" asChild>
              <a href="https://x.com/BordlyAI" target="_blank" rel="noopener noreferrer">
                <SiX className="size-4 h-3.5" />
                @BordlyAI
              </a>
            </Button>
          </div>
          <div className="flex flex-row justify-between items-center gap-4">
            <div className="text-sm font-semibold">Star us on GitHub</div>
            <Button variant="outline" asChild>
              <a href="https://github.com/BemiHQ/bordly" target="_blank" rel="noopener noreferrer">
                <SiGithub />
                BemiHQ/Bordly
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Button size="lg" asChild>
        <Link to={ROUTES.HOME}>
          Open board
          <ArrowRight data-icon="inline-end" />
        </Link>
      </Button>
    </div>
  );
};

function Welcome() {
  const [boardId, setBoardId] = useState<string>();
  const [finishedInviting, setFinishedInviting] = useState(false);

  if (!boardId) {
    return <NewBoard setBoardId={setBoardId} />;
  }
  if (!finishedInviting) {
    return <InviteMembers boardId={boardId} setFinishedInviting={setFinishedInviting} />;
  }

  return <FinalStep />;
}
