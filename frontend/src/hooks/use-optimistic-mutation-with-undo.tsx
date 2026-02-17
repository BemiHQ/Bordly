import type { useMutation } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { DEFAULT_TOASTER_DURATION_MS } from '@/components/ui/sonner';
import type { RouteContext } from '@/hooks/use-route-context';

export const useOptimisticMutationWithUndo = <TData, TError, TMutationParams>({
  queryClient,
  queryKey,
  onExecute,
  successToast,
  errorToast,
  delayedMutation,
}: {
  queryClient: RouteContext['queryClient'];
  queryKey: readonly unknown[];
  onExecute: (params: TMutationParams) => void;
  successToast: string;
  errorToast: string;
  delayedMutation: ReturnType<typeof useMutation<TData, TError, TMutationParams>>;
}) => {
  const pendingMutationsRef = useRef<Record<string, { params: TMutationParams; previousData: unknown }>>({});

  const execute = useCallback(
    (params: TMutationParams) => {
      const previousData = queryClient.getQueryData(queryKey);

      onExecute(params);

      const timeoutId = setTimeout(() => {
        const mutation = pendingMutationsRef.current[id];
        if (mutation) {
          delayedMutation.mutate(mutation.params, {
            onError: () => {
              queryClient.setQueryData(queryKey, mutation.previousData);
              toast.error(errorToast, { position: 'top-center' });
            },
          });
          delete pendingMutationsRef.current[id];
        }
      }, DEFAULT_TOASTER_DURATION_MS);

      const id = String(timeoutId);
      pendingMutationsRef.current[id] = { params, previousData };

      toast.success(successToast, {
        action: {
          label: 'Undo',
          onClick: () => {
            clearTimeout(timeoutId);
            const mutation = pendingMutationsRef.current[id];
            if (mutation) {
              queryClient.setQueryData(queryKey, mutation.previousData);
              delete pendingMutationsRef.current[id];
            }
          },
        },
        position: 'top-center',
      });
    },
    [queryKey, queryClient, delayedMutation, onExecute, successToast, errorToast],
  );

  return execute;
};
