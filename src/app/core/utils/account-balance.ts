export interface BalanceDisplay {
  label: string;
  amount: string;
  tone: 'positive' | 'negative' | 'neutral';
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.abs(value) || 0);
}

export function formatAccountBalance(balance: number): BalanceDisplay {
  const amount = formatCurrency(balance);

  if (balance > 0) {
    return { label: "You'll get", amount, tone: 'positive' };
  }
  if (balance < 0) {
    return { label: "You'll give", amount, tone: 'negative' };
  }
  return { label: 'Settled', amount: formatCurrency(0), tone: 'neutral' };
}

export function entryTypeLabel(
  type: 'debit' | 'credit',
  source: 'manual' | 'purchase' = 'manual',
): string {
  if (source === 'purchase') return 'Purchase';
  return type === 'debit' ? 'You gave' : 'You got';
}

export function isPurchaseLinkedSource(
  source: 'manual' | 'purchase' | undefined | null,
): boolean {
  return source === 'purchase';
}
