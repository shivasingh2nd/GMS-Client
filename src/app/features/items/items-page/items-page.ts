import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { Item, Purchase } from '../../../core/models/gms.models';
import { ItemService } from '../../../core/services/api/item.service';
import { PurchaseService } from '../../../core/services/api/purchase.service';
import { apiErrorMessage } from '../../../core/utils/api-error';
import { formatCurrency } from '../../../core/utils/account-balance';
import { toastMissingRequired } from '../../../core/utils/form-validation';

@Component({
  selector: 'app-items-page',
  imports: [DatePipe, ReactiveFormsModule, Button, Dialog, InputNumber, InputText, TableModule],
  templateUrl: './items-page.html',
})
export class ItemsPage implements OnInit {
  private readonly api = inject(ItemService);
  private readonly purchasesApi = inject(PurchaseService);
  private readonly fb = inject(FormBuilder);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly rows = signal<Item[]>([]);
  readonly loading = signal(false);
  readonly dialogVisible = signal(false);
  readonly saving = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly historyVisible = signal(false);
  readonly historyLoading = signal(false);
  readonly historyRows = signal<Purchase[]>([]);
  readonly historyItemName = signal('');

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    unit: [''],
    defaultRate: [null as number | null],
  });

  ngOnInit(): void {
    this.reload();
  }

  openCreate(): void {
    this.editingId.set(null);
    this.form.reset({ name: '', unit: '', defaultRate: null });
    this.dialogVisible.set(true);
  }

  openEdit(row: Item): void {
    this.editingId.set(row._id);
    this.form.reset({
      name: row.name,
      unit: row.unit || '',
      defaultRate: row.defaultRate ?? null,
    });
    this.dialogVisible.set(true);
  }

  confirmDelete(row: Item): void {
    this.confirm.confirm({
      header: 'Delete item?',
      message: `“${row.name}” will be hidden from lists.`,
      icon: 'pi pi-trash',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptIcon: 'pi pi-trash',
      accept: () => this.remove(row._id),
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      toastMissingRequired(this.messages);
      return;
    }
    const v = this.form.getRawValue();
    const id = this.editingId();
    const payload = {
      name: v.name.trim(),
      unit: v.unit.trim() || undefined,
      defaultRate: v.defaultRate != null ? Number(v.defaultRate) : null,
    };
    this.saving.set(true);
    const request = id ? this.api.update(id, payload) : this.api.create(payload);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogVisible.set(false);
        this.messages.add({
          severity: 'success',
          summary: id ? 'Item updated' : 'Item created',
        });
        this.reload();
      },
      error: (err) => {
        this.saving.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'Could not save item',
          detail: err?.error?.message || 'Request failed',
        });
      },
    });
  }

  formatRate(value?: number | null): string {
    return value != null ? formatCurrency(value) : '—';
  }

  openHistory(row: Item): void {
    this.historyItemName.set(row.name);
    this.historyVisible.set(true);
    this.historyLoading.set(true);
    this.purchasesApi.list({ item: row._id }).subscribe({
      next: (rows) => {
        this.historyRows.set(rows);
        this.historyLoading.set(false);
      },
      error: (err) => {
        this.historyLoading.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'Failed to load purchase history',
          detail: apiErrorMessage(err),
        });
      },
    });
  }

  purchaseDistributor(row: Purchase): string {
    const d = row.distributor;
    if (typeof d === 'object' && d) return d.name;
    return '—';
  }

  private remove(id: string): void {
    this.api.remove(id).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: 'Item deleted' });
        this.reload();
      },
      error: (err) => {
        this.messages.add({
          severity: 'error',
          summary: 'Could not delete item',
          detail: err?.error?.message || 'Request failed',
        });
      },
    });
  }

  private reload(): void {
    this.loading.set(true);
    this.api.list().subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'Failed to load items',
          detail: err?.error?.message || 'Request failed',
        });
      },
    });
  }
}
