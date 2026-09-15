import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { lastValueFrom } from 'rxjs';
import { Item, Purchase } from '../../../core/models/gms.models';
import { ItemService } from '../../../core/services/api/item.service';
import { PurchaseService } from '../../../core/services/api/purchase.service';
import {
  injectMutation,
  injectQuery,
  injectQueryClient,
  invalidateAfter,
  queryKeys,
  STALE,
} from '../../../core/query';
import { apiErrorMessage } from '../../../core/utils/api-error';
import { formatCurrency } from '../../../core/utils/account-balance';
import { toastMissingRequired } from '../../../core/utils/form-validation';
import { toUpperAlpha, UppercaseInputDirective } from '../../../shared/uppercase-input.directive';
import { QueryState } from '../../../shared/query-state/query-state';

@Component({
  selector: 'app-items-page',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    Button,
    Dialog,
    InputNumber,
    InputText,
    TableModule,
    UppercaseInputDirective,
    QueryState,
  ],
  templateUrl: './items-page.html',
})
export class ItemsPage {
  private readonly api = inject(ItemService);
  private readonly purchasesApi = inject(PurchaseService);
  private readonly fb = inject(FormBuilder);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  private readonly queryClient = injectQueryClient();

  readonly itemsQuery = injectQuery(() => ({
    queryKey: queryKeys.items.list(),
    queryFn: () => lastValueFrom(this.api.list()),
    staleTime: STALE.items,
  }));

  readonly historyItemId = signal<string | null>(null);

  readonly historyQuery = injectQuery(() => {
    const itemId = this.historyItemId();
    return {
      queryKey: queryKeys.purchases.list({ item: itemId ?? undefined }),
      queryFn: () => lastValueFrom(this.purchasesApi.list({ item: itemId! })),
      staleTime: STALE.purchases,
      enabled: !!itemId,
    };
  });

  readonly rows = computed(() => this.itemsQuery.data() ?? []);
  readonly loading = computed(() => this.itemsQuery.isPending() && !this.itemsQuery.data());
  readonly loadError = computed(() => this.itemsQuery.isError());
  readonly historyRows = computed(() => this.historyQuery.data() ?? []);
  readonly historyLoading = computed(
    () => !!this.historyItemId() && this.historyQuery.isPending() && !this.historyQuery.data(),
  );

  readonly dialogVisible = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly historyVisible = signal(false);
  readonly historyItemName = signal('');

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    unit: [''],
    defaultRate: [null as number | null],
  });

  readonly saveMutation = injectMutation(() => ({
    mutationFn: (input: {
      id: string | null;
      payload: { name: string; unit?: string; defaultRate?: number | null };
    }) =>
      lastValueFrom(
        input.id ? this.api.update(input.id, input.payload) : this.api.create(input.payload),
      ),
    onSuccess: async (_data, input) => {
      await invalidateAfter.item(this.queryClient);
      this.dialogVisible.set(false);
      this.messages.add({
        severity: 'success',
        summary: input.id ? 'Item updated' : 'Item created',
      });
    },
    onError: (err) => {
      this.messages.add({
        severity: 'error',
        summary: 'Could not save item',
        detail: apiErrorMessage(err),
      });
    },
  }));

  readonly deleteMutation = injectMutation(() => ({
    mutationFn: (id: string) => lastValueFrom(this.api.remove(id)),
    onSuccess: async () => {
      await invalidateAfter.item(this.queryClient);
      this.messages.add({ severity: 'success', summary: 'Item deleted' });
    },
    onError: (err) => {
      this.messages.add({
        severity: 'error',
        summary: 'Could not delete item',
        detail: apiErrorMessage(err),
      });
    },
  }));

  readonly saving = computed(() => this.saveMutation.isPending());

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
      accept: () => this.deleteMutation.mutate(row._id),
    });
  }

  retryLoad(): void {
    this.itemsQuery.refetch();
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      toastMissingRequired(this.messages);
      return;
    }
    const v = this.form.getRawValue();
    this.saveMutation.mutate({
      id: this.editingId(),
      payload: {
        name: toUpperAlpha(v.name.trim()),
        unit: v.unit.trim() ? toUpperAlpha(v.unit.trim()) : undefined,
        defaultRate: v.defaultRate != null ? Number(v.defaultRate) : null,
      },
    });
  }

  formatRate(value?: number | null): string {
    return value != null ? formatCurrency(value) : '—';
  }

  openHistory(row: Item): void {
    this.historyItemName.set(row.name);
    this.historyVisible.set(true);
    this.historyItemId.set(row._id);
  }

  purchaseDistributor(row: Purchase): string {
    const d = row.distributor;
    if (typeof d === 'object' && d) return d.name;
    return '—';
  }
}
