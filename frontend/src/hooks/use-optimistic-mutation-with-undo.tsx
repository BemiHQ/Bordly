import type { useMutation } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';
import type { RouteContext } from '@/hooks/use-route-context';

export const useOptimisticMutationWithUndo = <
  TQueryData,
  TMutationData,
  TMutationError,
  TMutationParams,
  TUndoMutationData,
  TUndoMutationError,
  TUndoMutationParams,
>({
  queryClient,
  queryKey,
  onExecute,
  successToast,
  errorToast,
  mutation,
  undoMutationConfig,
}: {
  queryClient: RouteContext['queryClient'];
  queryKey: readonly unknown[];
  onExecute: (params: TMutationParams) => void;
  successToast: string;
  errorToast: string;
  mutation: ReturnType<typeof useMutation<TMutationData, TMutationError, TMutationParams>>;
  undoMutationConfig: (
    params: TMutationParams,
    beforeMutationData: TQueryData | undefined,
  ) => {
    mutation: ReturnType<typeof useMutation<TUndoMutationData, TUndoMutationError, TUndoMutationParams>>;
    params: TUndoMutationParams;
  };
}) => {
  const execute = useCallback(
    (params: TMutationParams) => {
      const beforeMutationData = queryClient.getQueryData<TQueryData>(queryKey);
      onExecute(params);
      mutation.mutate(params, {
        onError: () => {
          queryClient.setQueryData(queryKey, beforeMutationData);
          toast.error(errorToast, { position: 'top-center' });
        },
      });

      toast.success(successToast, {
        action: {
          label: 'Undo',
          onClick: () => {
            const afterMutationData = queryClient.getQueryData<TQueryData>(queryKey);
            queryClient.setQueryData(queryKey, beforeMutationData);
            const { mutation: undoMutation, params: undoParams } = undoMutationConfig(params, beforeMutationData);
            undoMutation.mutate(undoParams, {
              onError: () => {
                queryClient.setQueryData(queryKey, afterMutationData);
                toast.error('Failed to undo action', { position: 'top-center' });
              },
            });
          },
        },
        position: 'top-center',
      });
    },
    [queryClient, queryKey, onExecute, successToast, errorToast, mutation, undoMutationConfig],
  );

  return execute;
};
