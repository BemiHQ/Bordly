import type { useMutation } from '@tanstack/react-query';
import { useCallback } from 'react';
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
  const execute = useCallback(
    (params: TMutationParams) => {
      const previousData = queryClient.getQueryData(queryKey);

      onExecute(params);

      mutation.mutate(params, {
        onSuccess,
        onError: () => {
          queryClient.setQueryData(queryKey, previousData);
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
