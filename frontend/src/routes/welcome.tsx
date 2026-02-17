import { createFileRoute, redirect } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { H1 } from '@/components/ui/h1';
import { Input } from '@/components/ui/input';
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

function Welcome() {
  const { currentUser } = Route.useLoaderData();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8">
      <H1>Create your first board</H1>

      <span className="text-muted-foreground">Boards are sharable spaces where you organize your emails.</span>

      <Card className="w-[400px]">
        <CardContent>
          <Field>
            <FieldLabel>Board Name</FieldLabel>
            <Input placeholder="Personal Board" defaultValue={`${currentUser.name.split(' ')[0]}'s Board`} />
          </Field>
        </CardContent>
        <CardFooter className="justify-center">
          <Button size="lg" variant="contrast">
            Create Board
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
