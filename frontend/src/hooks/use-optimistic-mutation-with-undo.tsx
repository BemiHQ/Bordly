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
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const previousDataRef = useRef<unknown>(null);

  const execute = useCallback(
    (params: TMutationParams) => {
      previousDataRef.current = queryClient.getQueryData(queryKey);

      onExecute(params);

      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
      const timeoutId = setTimeout(() => {
        delayedMutation.mutate(params, {
          onError: () => {
            queryClient.setQueryData(queryKey, previousDataRef.current);
            toast.error(errorToast, { position: 'top-center' });
          },
        });
      }, DEFAULT_TOASTER_DURATION_MS);
      timeoutIdRef.current = timeoutId;

      toast.success(successToast, {
        action: {
          label: 'Undo',
          onClick: () => {
            clearTimeout(timeoutId);
            timeoutIdRef.current = null;
            queryClient.setQueryData(queryKey, previousDataRef.current);
          },
        },
        position: 'top-center',
      });
    },
    [queryKey, queryClient, delayedMutation, onExecute, successToast, errorToast],
  );

  return execute;
};
