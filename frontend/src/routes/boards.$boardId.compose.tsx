import { useMutation } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { ensureLoggedIn } from '@/loaders/authentication';
import { addBoardCardData } from '@/query-helpers/board-card';
import { addBoardCardData as addBoardCardDataInList } from '@/query-helpers/board-cards';
import { extractUuid } from '@/utils/strings';
import { ROUTES } from '@/utils/urls';

export const Route = createFileRoute('/boards/$boardId/compose')({
  component: BoardComposeComponent,
  beforeLoad: ensureLoggedIn(ROUTES.BOARD_COMPOSE),
});

function BoardComposeComponent() {
  const params = Route.useParams();
  const navigate = useNavigate();
  const context = Route.useRouteContext();
  const { trpc, queryClient } = context;
  const mounted = useRef(false);

  const boardId = extractUuid(params.boardId);
  const createEmailDraftMutation = useMutation(trpc.boardCard.createWithEmailDraft.mutationOptions());

  // biome-ignore lint/correctness/useExhaustiveDependencies: run this on mount
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    (async () => {
      const { boardCard } = await createEmailDraftMutation.mutateAsync({ boardId });
      addBoardCardData({ queryClient, trpc, params: { boardId, boardCard: boardCard } });
      addBoardCardDataInList({ queryClient, trpc, params: { boardId, boardCard: boardCard } });
      navigate({ to: ROUTES.BOARD_CARD.replace('$boardId', params.boardId).replace('$boardCardId', boardCard.id) });
    })();
  }, []);

  return null;
}
