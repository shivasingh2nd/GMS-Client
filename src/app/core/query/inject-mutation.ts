import {
  DestroyRef,
  assertInInjectionContext,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  DefaultError,
  MutationObserver,
  MutationObserverResult,
} from '@tanstack/query-core';
import { QUERY_CLIENT } from './provide-query-client';

export type InjectMutationOptions<TData, TVariables, TError = DefaultError> = {
  mutationFn: (variables: TVariables) => Promise<TData>;
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
  onError?: (error: TError, variables: TVariables) => void;
};

export type InjectMutationResult<TData, TVariables, TError = DefaultError> = {
  data: ReturnType<typeof signal<TData | undefined>>;
  error: ReturnType<typeof signal<TError | null>>;
  status: ReturnType<typeof signal<MutationObserverResult['status']>>;
  isPending: ReturnType<typeof computed<boolean>>;
  isError: ReturnType<typeof computed<boolean>>;
  isSuccess: ReturnType<typeof computed<boolean>>;
  mutate: (
    variables: TVariables,
    options?: {
      onSuccess?: (data: TData, variables: TVariables) => void;
      onError?: (error: TError, variables: TVariables) => void;
    },
  ) => void;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  reset: () => void;
};

export function injectMutation<TData, TVariables, TError = DefaultError>(
  optionsFn: () => InjectMutationOptions<TData, TVariables, TError>,
): InjectMutationResult<TData, TVariables, TError> {
  assertInInjectionContext(injectMutation);
  const client = inject(QUERY_CLIENT);
  const destroyRef = inject(DestroyRef);

  const data = signal<TData | undefined>(undefined);
  const error = signal<TError | null>(null);
  const status = signal<MutationObserverResult['status']>('idle');

  const options = optionsFn();
  const observer = new MutationObserver<TData, TError, TVariables, unknown>(client, {
    mutationFn: options.mutationFn,
    onSuccess: options.onSuccess,
    onError: options.onError,
  });

  const unsubscribe = observer.subscribe((result) => {
    data.set(result.data);
    error.set(result.error);
    status.set(result.status);
  });

  destroyRef.onDestroy(() => {
    unsubscribe();
  });

  return {
    data,
    error,
    status,
    isPending: computed(() => status() === 'pending'),
    isError: computed(() => status() === 'error'),
    isSuccess: computed(() => status() === 'success'),
    mutate: (variables, callbacks) => {
      void observer.mutate(variables, callbacks);
    },
    mutateAsync: (variables) => observer.mutate(variables),
    reset: () => observer.reset(),
  };
}
