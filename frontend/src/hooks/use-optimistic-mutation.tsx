import type { useMutation } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import type { RouteContext } from '@/hooks/use-route-context';

export const useOptimisticMutation = <TData, TError, TMutationParams>({
  queryClient,
  queryKey,
  onExecute,
  onSuccess,
  successToast,
  errorToast,
  mutation,
}: {
  queryClient: RouteContext['queryClient'];
  queryKey: readonly unknown[];
  onExecute: (params: TMutationParams) => void;
  onSuccess?: (data: TData) => void;
  successToast?: string;
  errorToast: string;
  mutation: ReturnType<typeof useMutation<TData, TError, TMutationParams>>;
}) => {
  const previousDataRef = useRef<unknown>(null);

  const execute = useCallback(
    (params: TMutationParams) => {
      previousDataRef.current = queryClient.getQueryData(queryKey);

      onExecute(params);

      mutation.mutate(params, {
        onSuccess,
        onError: () => {
          queryClient.setQueryData(queryKey, previousDataRef.current);
          toast.error(errorToast, { position: 'top-center' });
        },
      });

      if (successToast) {
        toast.success(successToast, { position: 'top-center' });
      }
    },
    [queryKey, queryClient, mutation, onExecute, onSuccess, successToast, errorToast],
  );

  return execute;
};
