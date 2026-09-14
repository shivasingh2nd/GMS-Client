import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import {
  AccountEntry,
  AccountEntryType,
  AccountLedgerResponse,
  LedgerPurchase,
  Party,
  PurchaseItem,
} from '../../../core/models/gms.models';
import { AccountEntryService } from '../../../core/services/api/account-entry.service';
import { AccountReportService } from '../../../core/services/api/account-report.service';
import { PartyService } from '../../../core/services/api/party.service';
import { apiErrorMessage } from '../../../core/utils/api-error';
import {
  entryTypeLabel,
  formatAccountBalance,
  formatCurrency,
  isPurchaseLinkedSource,
} from '../../../core/utils/account-balance';
import { downloadCsv, downloadPdf, ExportCell } from '../../../core/utils/export-report';
import {
  endOfLastMonth,
  endOfMonth,
  startOfLastMonth,
  startOfMonth,
  toIsoDate,
} from '../../../core/utils/date';
import { toastMissingRequired } from '../../../core/utils/form-validation';

interface LedgerDisplayRow {
  entry: AccountEntry;
  isFirst: boolean;
  itemName: string;
  unit: string;
  qty: number | null;
  rate: number | null;
}

@Component({
  selector: 'app-account-ledger',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    Button,
    DatePicker,
    Dialog,
    InputNumber,
    InputText,
    Select,
    TableModule,
  ],
  templateUrl: './account-ledger.html',
})
export class AccountLedgerPage implements OnInit {
  private readonly reportApi = inject(AccountReportService);
  private readonly entriesApi = inject(AccountEntryService);
  private readonly partiesApi = inject(PartyService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly parties = signal<Party[]>([]);
  readonly ledger = signal<AccountLedgerResponse | null>(null);
  readonly loading = signal(false);
  readonly editDialogVisible = signal(false);
  readonly saving = signal(false);
  readonly editingEntryId = signal<string | null>(null);

  selectedPartyId: string | null = null;
  fromDate: Date = startOfMonth(new Date());
  toDate: Date = endOfMonth(new Date());

  readonly editForm = this.fb.nonNullable.group({
    type: ['debit' as AccountEntryType, Validators.required],
    date: [new Date() as Date, Validators.required],
    amount: [null as number | null, Validators.required],
    particular: [''],
  });

  readonly displayRows = computed(() => {
    const data = this.ledger();
    if (!data) return [] as LedgerDisplayRow[];

    const rows: LedgerDisplayRow[] = [];
    for (const entry of data.rows) {
      const items = this.purchaseItems(entry);
      if (items.length > 0) {
        items.forEach((item, index) => {
          rows.push({
            entry,
            isFirst: index === 0,
            itemName: this.purchaseItemName(item),
            unit: this.purchaseItemUnit(item),
            qty: item.quantity,
            rate: item.rate,
          });
        });
      } else {
        rows.push({
          entry,
          isFirst: true,
          itemName: '',
          unit: '',
          qty: null,
          rate: null,
        });
      }
    }
    return rows;
  });

  ngOnInit(): void {
    this.partiesApi.list().subscribe({
      next: (rows) => {
        this.parties.set(rows);
        const partyId = this.route.snapshot.queryParamMap.get('partyId');
        if (partyId && rows.some((p) => p._id === partyId)) {
          this.selectedPartyId = partyId;
          this.loadLedger();
        } else if (rows.length === 1) {
          this.selectedPartyId = rows[0]._id;
          this.syncPartyQuery(rows[0]._id);
          this.loadLedger();
        }
      },
      error: (err) => {
        this.messages.add({
          severity: 'error',
          summary: 'Failed to load parties',
          detail: apiErrorMessage(err),
        });
      },
    });
  }

  onPartyChange(): void {
    this.syncPartyQuery(this.selectedPartyId);
    this.ledger.set(null);
    if (this.selectedPartyId) {
      this.loadLedger();
    }
  }

  applyFilters(): void {
    if (!this.selectedPartyId) {
      this.messages.add({
        severity: 'warn',
        summary: 'Select a party',
        detail: 'Choose a party to view its ledger.',
      });
      return;
    }
    this.loadLedger();
  }

  resetCurrentMonth(): void {
    const now = new Date();
    this.fromDate = startOfMonth(now);
    this.toDate = endOfMonth(now);
    if (this.selectedPartyId) {
      this.loadLedger();
    }
  }

  resetLastMonth(): void {
    const now = new Date();
    this.fromDate = startOfLastMonth(now);
    this.toDate = endOfLastMonth(now);
    if (this.selectedPartyId) {
      this.loadLedger();
    }
  }

  exportCsv(): void {
    const table = this.buildExportTable();
    if (!table) return;
    downloadCsv(table);
  }

  exportPdf(): void {
    const table = this.buildExportTable();
    if (!table) return;
    downloadPdf(table);
  }

  openEdit(entry: AccountEntry): void {
    this.editingEntryId.set(entry._id);
    this.editForm.reset({
      type: entry.type,
      date: new Date(entry.date),
      amount: entry.amount,
      particular: entry.particular || '',
    });
    this.editDialogVisible.set(true);
  }

  confirmDelete(entry: AccountEntry): void {
    this.confirm.confirm({
      header: 'Delete entry?',
      message: `Remove this ${entryTypeLabel(entry.type, entry.source).toLowerCase()} entry of ${formatCurrency(entry.amount)}?`,
      icon: 'pi pi-trash',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptIcon: 'pi pi-trash',
      accept: () => this.removeEntry(entry._id),
    });
  }

  saveEdit(): void {
    const id = this.editingEntryId();
    if (!id) return;
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      toastMissingRequired(this.messages);
      return;
    }
    const v = this.editForm.getRawValue();
    this.saving.set(true);
    this.entriesApi
      .update(id, {
        type: v.type,
        date: toIsoDate(v.date),
        amount: Number(v.amount),
        particular: v.particular.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.editDialogVisible.set(false);
          this.messages.add({ severity: 'success', summary: 'Entry updated' });
          this.loadLedger();
          this.partiesApi.list().subscribe({ next: (rows) => this.parties.set(rows) });
        },
        error: (err) => {
          this.saving.set(false);
          this.messages.add({
            severity: 'error',
            summary: 'Could not update entry',
            detail: apiErrorMessage(err),
          });
        },
      });
  }

  formatBalance(balance: number): ReturnType<typeof formatAccountBalance> {
    return formatAccountBalance(balance);
  }

  selectedPartyBalance(): ReturnType<typeof formatAccountBalance> | null {
    if (!this.selectedPartyId) return null;
    const party = this.parties().find((p) => p._id === this.selectedPartyId);
    if (!party) return null;
    return formatAccountBalance(party.currentBalance ?? party.openingBalance);
  }

  formatAmount(value: number): string {
    return formatCurrency(value);
  }

  formatDate(value: string | Date): string {
    return new Date(value).toLocaleDateString();
  }

  entryLabel(entry: AccountEntry): string {
    return entryTypeLabel(entry.type, entry.source ?? 'manual');
  }

  isPurchaseLinked(entry: AccountEntry): boolean {
    return isPurchaseLinkedSource(entry.source);
  }

  isPurchaseEntry(entry: AccountEntry): boolean {
    return entry.source === 'purchase' && !!entry.purchase && typeof entry.purchase === 'object';
  }

  purchaseDetails(entry: AccountEntry): LedgerPurchase | null {
    if (!entry.purchase || typeof entry.purchase === 'string') return null;
    return entry.purchase;
  }

  purchaseItems(entry: AccountEntry): PurchaseItem[] {
    return this.purchaseDetails(entry)?.items ?? [];
  }

  purchaseHeader(entry: AccountEntry): string | null {
    const purchase = this.purchaseDetails(entry);
    if (!purchase) return entry.particular || null;
    const parts: string[] = [];
    if (purchase.invoiceNumber?.trim()) {
      parts.push(`Invoice ${purchase.invoiceNumber.trim()}`);
    }
    if (purchase.remarks?.trim()) {
      parts.push(purchase.remarks.trim());
    }
    return parts.length ? parts.join(' · ') : entry.particular || 'Purchase';
  }

  purchaseItemName(item: PurchaseItem): string {
    if (typeof item.item === 'object' && item.item) {
      return item.item.name;
    }
    return 'Item';
  }

  purchaseItemUnit(item: PurchaseItem): string {
    if (typeof item.item === 'object' && item.item?.unit) {
      return item.item.unit;
    }
    return '';
  }

  particularText(entry: AccountEntry): string {
    if (this.isPurchaseEntry(entry)) {
      return this.purchaseHeader(entry) || entry.particular || '—';
    }
    return entry.particular || '—';
  }

  private buildExportTable() {
    const data = this.ledger();
    if (!data?.rows.length) {
      this.messages.add({
        severity: 'warn',
        summary: 'Nothing to export',
        detail: 'Load a ledger with entries first.',
      });
      return null;
    }

    const headers = [
      'Date',
      'Type',
      'Particular',
      'Item',
      'Unit',
      'Qty',
      'Rate',
      'Debit',
      'Credit',
      'Balance',
    ];
    const rows: ExportCell[][] = [];

    for (const row of data.rows) {
      const items = this.purchaseItems(row);
      const typeLabel = this.entryLabel(row);
      const particular = this.isPurchaseEntry(row)
        ? this.purchaseHeader(row) || row.particular || ''
        : row.particular || '';
      const debit = row.type === 'debit' ? row.amount : '';
      const credit = row.type === 'credit' ? row.amount : '';
      const balance = row.balance ?? '';

      if (items.length > 0) {
        items.forEach((item, index) => {
          rows.push([
            index === 0 ? row.date : '',
            index === 0 ? typeLabel : '',
            index === 0 ? particular : '',
            this.purchaseItemName(item),
            this.purchaseItemUnit(item),
            item.quantity,
            item.rate,
            index === 0 ? debit : '',
            index === 0 ? credit : '',
            index === 0 ? balance : '',
          ]);
        });
      } else {
        rows.push([
          row.date,
          typeLabel,
          particular,
          '',
          '',
          '',
          '',
          debit,
          credit,
          balance,
        ]);
      }
    }

    return {
      title: `Account ledger · ${data.party.name}`,
      subtitle: `${toIsoDate(this.fromDate)} to ${toIsoDate(this.toDate)} · Opening ${this.formatAmount(data.openingBalance)} · Closing ${this.formatAmount(data.closingBalance)}`,
      headers,
      rows,
      filename: `ledger-${data.party.name.replace(/\s+/g, '-')}`,
    };
  }

  private loadLedger(): void {
    if (!this.selectedPartyId) return;
    this.loading.set(true);
    this.reportApi
      .ledger({
        party: this.selectedPartyId,
        from: toIsoDate(this.fromDate),
        to: toIsoDate(this.toDate),
      })
      .subscribe({
        next: (data) => {
          this.ledger.set(data);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.messages.add({
            severity: 'error',
            summary: 'Failed to load ledger',
            detail: apiErrorMessage(err),
          });
        },
      });
  }

  private removeEntry(id: string): void {
    this.entriesApi.remove(id).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: 'Entry deleted' });
        this.loadLedger();
        this.partiesApi.list().subscribe({ next: (rows) => this.parties.set(rows) });
      },
      error: (err) => {
        this.messages.add({
          severity: 'error',
          summary: 'Could not delete entry',
          detail: apiErrorMessage(err),
        });
      },
    });
  }

  private syncPartyQuery(partyId: string | null): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: partyId ? { partyId } : {},
      replaceUrl: true,
    });
  }

}
