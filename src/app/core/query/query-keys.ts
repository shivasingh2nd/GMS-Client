export type DacListFilters = {
  from?: string;
  to?: string;
  distributor?: string;
  consumerNumber?: string;
  limit?: number;
};

export type PurchaseListFilters = {
  distributor?: string;
  from?: string;
  to?: string;
  item?: string;
};

export type EntryListFilters = {
  party?: string;
  from?: string;
  to?: string;
  limit?: number;
};

export type LedgerFilters = {
  party: string;
  from?: string;
  to?: string;
};

export type ConsumerListFilters = {
  distributor?: string;
  consumerNumber?: string;
  phone?: string;
  name?: string;
  page?: number;
  limit?: number;
};

export const queryKeys = {
  distributors: {
    all: ['distributors'] as const,
    list: (company?: string) => ['distributors', company ?? 'all'] as const,
  },
  items: {
    all: ['items'] as const,
    list: () => ['items'] as const,
  },
  parties: {
    all: ['parties'] as const,
    list: () => ['parties'] as const,
  },
  consumers: {
    all: ['consumers'] as const,
    list: (filters: ConsumerListFilters = {}) => ['consumers', filters] as const,
    lookup: (distributorId: string, consumerNumber: string) =>
      ['consumers', 'lookup', distributorId, consumerNumber] as const,
  },
  dacs: {
    all: ['dacs'] as const,
    list: (filters: DacListFilters = {}) => ['dacs', filters] as const,
  },
  purchases: {
    all: ['purchases'] as const,
    list: (filters: PurchaseListFilters = {}) => ['purchases', filters] as const,
  },
  entries: {
    all: ['entries'] as const,
    list: (filters: EntryListFilters = {}) => ['entries', filters] as const,
  },
  accounts: {
    all: ['accounts'] as const,
    summary: () => ['accounts', 'summary'] as const,
    ledger: (filters: LedgerFilters) =>
      ['accounts', 'ledger', filters.party, filters.from ?? '', filters.to ?? ''] as const,
  },
  users: {
    all: ['users'] as const,
    list: () => ['users'] as const,
  },
} as const;
