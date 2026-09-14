import { Consumer, Dac, Distributor } from '../models/gms.models';

export function distributorLabel(distributor: Distributor | string | null | undefined): string {
  if (!distributor || typeof distributor === 'string') return '—';
  return `${distributor.name} (${distributor.company})`;
}

export function distributorOptionLabel(distributor: Distributor): string {
  return `${distributor.name} (${distributor.company})`;
}

export function consumerDistributorLabel(row: Consumer): string {
  const d = row.distributor;
  if (typeof d === 'string') return d;
  return distributorLabel(d);
}

export function dacBookingLabel(row: Dac): string {
  const d = row.bookingInDistributor;
  if (typeof d === 'string') return d;
  return distributorLabel(d);
}

export function distributorIdFromParty(
  distributor: Distributor | string | null | undefined,
): string | null {
  if (!distributor) return null;
  return typeof distributor === 'string' ? distributor : distributor._id;
}
