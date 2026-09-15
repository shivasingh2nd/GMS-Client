import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { lastValueFrom } from 'rxjs';
import {
  AccountEntry,
  Dac,
  Party,
  Purchase,
} from '../../../core/models/gms.models';
import { AccountEntryService } from '../../../core/services/api/account-entry.service';
import { AccountReportService } from '../../../core/services/api/account-report.service';
import { DacService } from '../../../core/services/api/dac.service';
import { PurchaseService } from '../../../core/services/api/purchase.service';
import { injectQuery, queryKeys, STALE } from '../../../core/query';
import { apiErrorMessage } from '../../../core/utils/api-error';
import { entryTypeLabel, formatAccountBalance, formatCurrency } from '../../../core/utils/account-balance';
import { dacBookingLabel } from '../../../core/utils/distributor';
import { endOfMonth, startOfMonth, toIsoDate } from '../../../core/utils/date';
import { QueryState } from '../../../shared/query-state/query-state';

@Component({
  selector: 'app-dashboard-page',
  imports: [DatePipe, RouterLink, Button, TableModule, QueryState],
  templateUrl: './dashboard-page.html',
})
export class DashboardPage {
  private readonly summaryApi = inject(AccountReportService);
  private readonly dacApi = inject(DacService);
  private readonly purchaseApi = inject(PurchaseService);
  private readonly entriesApi = inject(AccountEntryService);

  private readonly monthRange = (() => {
    const now = new Date();
    return {
      from: toIsoDate(startOfMonth(now)),
      to: toIsoDate(endOfMonth(now)),
    };
  })();

  readonly summaryQuery = injectQuery(() => ({
    queryKey: queryKeys.accounts.summary(),
    queryFn: () => lastValueFrom(this.summaryApi.summary()),
    staleTime: STALE.summary,
  }));

  readonly recentDacsQuery = injectQuery(() => ({
    queryKey: queryKeys.dacs.list({ limit: 5 }),
    queryFn: () => lastValueFrom(this.dacApi.list({ limit: 5 })),
    staleTime: STALE.dacs,
  }));

  readonly purchasesQuery = injectQuery(() => ({
    queryKey: queryKeys.purchases.list(this.monthRange),
    queryFn: () => lastValueFrom(this.purchaseApi.list(this.monthRange)),
    staleTime: STALE.purchases,
  }));

  readonly recentEntriesQuery = injectQuery(() => ({
    queryKey: queryKeys.entries.list({ limit: 5 }),
    queryFn: () => lastValueFrom(this.entriesApi.list({ limit: 5 })),
    staleTime: STALE.entries,
  }));

  readonly summary = computed(() => this.summaryQuery.data() ?? null);
  readonly recentDacs = computed(() => this.recentDacsQuery.data() ?? []);
  readonly recentPurchases = computed(() => (this.purchasesQuery.data() ?? []).slice(0, 5));
  readonly recentEntries = computed(() => this.recentEntriesQuery.data() ?? []);
  readonly loading = computed(
    () =>
      (this.summaryQuery.isPending() && !this.summaryQuery.data()) ||
      (this.recentDacsQuery.isPending() && !this.recentDacsQuery.data()) ||
      (this.purchasesQuery.isPending() && !this.purchasesQuery.data()) ||
      (this.recentEntriesQuery.isPending() && !this.recentEntriesQuery.data()),
  );
  readonly hasError = computed(
    () =>
      this.summaryQuery.isError() ||
      this.recentDacsQuery.isError() ||
      this.purchasesQuery.isError() ||
      this.recentEntriesQuery.isError(),
  );
  readonly errorDetail = computed(() => {
    const err =
      this.summaryQuery.error() ||
      this.recentDacsQuery.error() ||
      this.purchasesQuery.error() ||
      this.recentEntriesQuery.error();
    return err ? apiErrorMessage(err) : '';
  });

  retryAll(): void {
    this.summaryQuery.refetch();
    this.recentDacsQuery.refetch();
    this.purchasesQuery.refetch();
    this.recentEntriesQuery.refetch();
  }

  formatAmount(amount: number): string {
    return formatCurrency(amount);
  }

  partyBalance(row: Party): string {
    return formatAccountBalance(row.currentBalance ?? row.openingBalance).amount;
  }

  partyBalanceLabel(row: Party): string {
    return formatAccountBalance(row.currentBalance ?? row.openingBalance).label;
  }

  dacDistributor(row: Dac): string {
    return dacBookingLabel(row);
  }

  purchaseDistributor(row: Purchase): string {
    const d = row.distributor;
    if (typeof d === 'string') return d;
    return d?.name ?? '—';
  }

  entryPartyName(row: AccountEntry): string {
    const p = row.party;
    if (typeof p === 'string') return p;
    return p?.name ?? '—';
  }

  entryLabel(row: AccountEntry): string {
    return entryTypeLabel(row.type, row.source ?? 'manual');
  }
}
