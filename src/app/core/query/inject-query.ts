import {
  DestroyRef,
  assertInInjectionContext,
  inject,
  signal,
  computed,
  effect,
  untracked,
} from '@angular/core';
import {
  QueryClient,
  QueryObserver,
  QueryKey,
  QueryObserverResult,
  DefaultError,
} from '@tanstack/query-core';
import { QUERY_CLIENT } from './provide-query-client';

export type InjectQueryOptions<TData, TKey extends QueryKey = QueryKey> = {
  queryKey: TKey;
  queryFn: () => Promise<TData>;
  staleTime?: number;
  gcTime?: number;
  enabled?: boolean;
  retry?: number | boolean;
};

export type InjectQueryResult<TData> = {
  data: ReturnType<typeof signal<TData | undefined>>;
  error: ReturnType<typeof signal<DefaultError | null>>;
  status: ReturnType<typeof signal<QueryObserverResult['status']>>;
  fetchStatus: ReturnType<typeof signal<QueryObserverResult['fetchStatus']>>;
  isPending: ReturnType<typeof computed<boolean>>;
  isFetching: ReturnType<typeof computed<boolean>>;
  isError: ReturnType<typeof computed<boolean>>;
  isSuccess: ReturnType<typeof computed<boolean>>;
  refetch: () => void;
};

/**
 * Thin Angular signal adapter over stable `@tanstack/query-core` QueryObserver.
 * Options are re-read reactively when the factory closes over signals.
 */
export function injectQuery<TData, TKey extends QueryKey = QueryKey>(
  optionsFn: () => InjectQueryOptions<TData, TKey>,
): InjectQueryResult<TData> {
  assertInInjectionContext(injectQuery);
  const client = inject(QUERY_CLIENT);
  const destroyRef = inject(DestroyRef);

  const data = signal<TData | undefined>(undefined);
  const error = signal<DefaultError | null>(null);
  const status = signal<QueryObserverResult['status']>('pending');
  const fetchStatus = signal<QueryObserverResult['fetchStatus']>('idle');

  let observer: QueryObserver<TData, DefaultError, TData, TData, TKey> | undefined;
  let unsubscribe: (() => void) | undefined;

  const applyResult = (result: QueryObserverResult<TData, DefaultError>) => {
    data.set(result.data);
    error.set(result.error);
    status.set(result.status);
    fetchStatus.set(result.fetchStatus);
  };

  effect(() => {
    const options = optionsFn();
    untracked(() => {
      const observerOptions = {
        queryKey: options.queryKey,
        queryFn: options.queryFn,
        staleTime: options.staleTime,
        gcTime: options.gcTime,
        enabled: options.enabled ?? true,
        retry: options.retry,
      };

      if (!observer) {
        observer = new QueryObserver(client, observerOptions);
        unsubscribe = observer.subscribe((result) => applyResult(result));
        applyResult(observer.getCurrentResult());
      } else {
        observer.setOptions(observerOptions);
        applyResult(observer.getCurrentResult());
      }
    });
  });

  destroyRef.onDestroy(() => {
    unsubscribe?.();
    observer?.destroy();
  });

  return {
    data,
    error,
    status,
    fetchStatus,
    isPending: computed(() => status() === 'pending'),
    isFetching: computed(() => fetchStatus() === 'fetching'),
    isError: computed(() => status() === 'error'),
    isSuccess: computed(() => status() === 'success'),
    refetch: () => {
      void observer?.refetch();
    },
  };
}

export function injectQueryClient(): QueryClient {
  assertInInjectionContext(injectQueryClient);
  return inject(QUERY_CLIENT);
}
