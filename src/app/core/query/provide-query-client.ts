import { InjectionToken, Provider } from '@angular/core';
import { QueryClient } from '@tanstack/query-core';
import { GC_TIME } from './stale-times';

export const QUERY_CLIENT = new InjectionToken<QueryClient>('GmsQueryClient');

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: GC_TIME,
        retry: 1,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
    },
  });
}

export function provideQueryClient(): Provider[] {
  return [
    {
      provide: QUERY_CLIENT,
      useFactory: createQueryClient,
    },
  ];
}
