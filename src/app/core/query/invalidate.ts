import { QueryClient } from '@tanstack/query-core';
import { queryKeys } from './query-keys';

/** Prefix-invalidate helpers used by mutations. */
export const invalidateAfter = {
  dac(client: QueryClient): Promise<void> {
    return Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.dacs.all }),
      client.invalidateQueries({ queryKey: queryKeys.consumers.all }),
    ]).then(() => undefined);
  },

  purchase(client: QueryClient): Promise<void> {
    return Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.purchases.all }),
      client.invalidateQueries({ queryKey: queryKeys.parties.all }),
      client.invalidateQueries({ queryKey: queryKeys.accounts.all }),
      client.invalidateQueries({ queryKey: queryKeys.entries.all }),
    ]).then(() => undefined);
  },

  accountEntry(client: QueryClient): Promise<void> {
    return Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.entries.all }),
      client.invalidateQueries({ queryKey: queryKeys.parties.all }),
      client.invalidateQueries({ queryKey: queryKeys.accounts.all }),
    ]).then(() => undefined);
  },

  party(client: QueryClient): Promise<void> {
    return Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.parties.all }),
      client.invalidateQueries({ queryKey: queryKeys.accounts.all }),
    ]).then(() => undefined);
  },

  distributor(client: QueryClient): Promise<void> {
    return Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.distributors.all }),
      client.invalidateQueries({ queryKey: queryKeys.parties.all }),
    ]).then(() => undefined);
  },

  item(client: QueryClient): Promise<void> {
    return client.invalidateQueries({ queryKey: queryKeys.items.all });
  },

  consumer(client: QueryClient): Promise<void> {
    return client.invalidateQueries({ queryKey: queryKeys.consumers.all });
  },

  user(client: QueryClient): Promise<void> {
    return client.invalidateQueries({ queryKey: queryKeys.users.all });
  },
};
