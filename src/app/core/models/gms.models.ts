export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive?: boolean;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export type CompanyCode = 'HPCL' | 'BPCL' | 'IOCL';

export const COMPANIES: CompanyCode[] = ['HPCL', 'BPCL', 'IOCL'];

export interface Distributor {
  _id: string;
  name: string;
  phone?: string;
  address: string;
  company: CompanyCode;
}
export interface Consumer {
  _id: string;
  consumerNumber: string;
  name: string;
  fatherName?: string;
  phone?: string;
  address?: string;
  distributor: Distributor | string;
}

export interface Dac {
  _id: string;
  consumer: Consumer | string;
  dacNumber: string;
  dacDate: string;
  amount: number;
  paymentMethod: string;
  deliveryDone: boolean;
  remarks?: string;
  bookingInDistributor: Distributor | string;
  intervalDays: number;
}

export interface ConsumerLookupResult {
  found: boolean;
  consumer: Consumer | null;
  lastDac: Dac | null;
  nextEligibleDate: string | null;
}

export interface CreateDacPayload {
  distributorId: string;
  bookingDistributorId?: string;
  consumerNumber: string;
  consumer?: {
    name?: string;
    fatherName?: string;
    phone?: string;
    address?: string;
  };
  dacNumber: string;
  dacDate: string;
  amount: number;
  paymentMethod: string;
  deliveryDone: boolean;
  intervalDays: number;
  remarks?: string;
}

export interface CreateDacResponse {
  dac: Dac;
  consumerCreated: boolean;
}

export interface UpdateDacPayload {
  dacNumber?: string;
  dacDate?: string;
  amount?: number;
  paymentMethod?: string;
  deliveryDone?: boolean;
  intervalDays?: number;
  remarks?: string;
  bookingDistributorId?: string;
}

export interface PurchaseLinePayload {
  item: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface CreatePurchasePayload {
  distributor: string;
  purchaseDate: string;
  invoiceNumber?: string;
  items: PurchaseLinePayload[];
  totalAmount?: number;
  remarks?: string;
  recordPayment?: boolean;
  paymentAmount?: number;
  paymentParticular?: string;
}

export type AccountEntryType = 'debit' | 'credit';

export type AccountEntrySource = 'manual' | 'purchase';

export interface Party {
  _id: string;
  name: string;
  phone?: string;
  notes?: string;
  openingBalance: number;
  currentBalance?: number;
  distributor?: Distributor | string | null;
}

export interface Item {
  _id: string;
  name: string;
  unit?: string;
  defaultRate?: number | null;
}

export interface LedgerPurchase {
  _id: string;
  invoiceNumber?: string;
  remarks?: string;
  items: PurchaseItem[];
  purchaseDate?: string;
}

export interface AccountEntry {
  _id: string;
  party: Party | string;
  date: string;
  type: AccountEntryType;
  amount: number;
  particular?: string;
  source: AccountEntrySource;
  balance?: number;
  purchase?: LedgerPurchase | string | null;
}

export interface AccountSummaryResponse {
  data: Party[];
  totalReceivable: number;
  totalPayable: number;
  netBalance: number;
}

export interface AccountLedgerResponse {
  party: Pick<Party, '_id' | 'name' | 'phone' | 'openingBalance'>;
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  rows: AccountEntry[];
}

export interface PurchaseItem {
  item: Item | string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface Purchase {
  _id: string;
  distributor: Distributor | string;
  purchaseDate: string;
  invoiceNumber?: string;
  items: PurchaseItem[];
  totalAmount: number;
  remarks?: string;
}
