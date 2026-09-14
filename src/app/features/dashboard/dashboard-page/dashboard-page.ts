import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { TableModule } from 'primeng/table';
import {
  AccountEntry,
  AccountSummaryResponse,
  Dac,
  Party,
  Purchase,
} from '../../../core/models/gms.models';
import { AccountEntryService } from '../../../core/services/api/account-entry.service';
import { AccountReportService } from '../../../core/services/api/account-report.service';
import { DacService } from '../../../core/services/api/dac.service';
import { PurchaseService } from '../../../core/services/api/purchase.service';
import { apiErrorMessage } from '../../../core/utils/api-error';
import { entryTypeLabel, formatAccountBalance, formatCurrency } from '../../../core/utils/account-balance';
import { dacBookingLabel } from '../../../core/utils/distributor';
import { endOfMonth, startOfMonth, toIsoDate } from '../../../core/utils/date';

@Component({
  selector: 'app-dashboard-page',
  imports: [DatePipe, RouterLink, Button, TableModule],
  templateUrl: './dashboard-page.html',
})
export class DashboardPage implements OnInit {
  private readonly summaryApi = inject(AccountReportService);
  private readonly dacApi = inject(DacService);
  private readonly purchaseApi = inject(PurchaseService);
  private readonly entriesApi = inject(AccountEntryService);
  private readonly messages = inject(MessageService);

  readonly loading = signal(true);
  readonly summary = signal<AccountSummaryResponse | null>(null);
  readonly recentDacs = signal<Dac[]>([]);
  readonly recentPurchases = signal<Purchase[]>([]);
  readonly recentEntries = signal<AccountEntry[]>([]);

  ngOnInit(): void {
    const now = new Date();
    const from = toIsoDate(startOfMonth(now));
    const to = toIsoDate(endOfMonth(now));

    this.summaryApi.summary().subscribe({
      next: (data) => this.summary.set(data),
      error: (err) => this.toast('Failed to load summary', err),
    });

    this.dacApi.list({ limit: 5 }).subscribe({
      next: (rows) => this.recentDacs.set(rows),
      error: (err) => this.toast('Failed to load recent DACs', err),
    });

    this.purchaseApi.list({ from, to }).subscribe({
      next: (rows) => this.recentPurchases.set(rows.slice(0, 5)),
      error: (err) => this.toast('Failed to load purchases', err),
    });

    this.entriesApi.list({ limit: 5 }).subscribe({
      next: (rows) => {
        this.recentEntries.set(rows);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast('Failed to load recent entries', err);
      },
    });
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

  private toast(summary: string, err: unknown): void {
    this.messages.add({
      severity: 'error',
      summary,
      detail: apiErrorMessage(err),
    });
  }
}
