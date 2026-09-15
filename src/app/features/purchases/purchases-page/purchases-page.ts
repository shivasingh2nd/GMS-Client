import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { Textarea } from 'primeng/textarea';
import { lastValueFrom } from 'rxjs';
import { Item, Purchase, PurchaseItem } from '../../../core/models/gms.models';
import { DistributorService } from '../../../core/services/api/distributor.service';
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
import { distributorOptionLabel } from '../../../core/utils/distributor';
import { endOfMonth, startOfMonth, toIsoDate } from '../../../core/utils/date';
import { downloadCsv, downloadPdf, ExportCell } from '../../../core/utils/export-report';
import { toastMissingRequired } from '../../../core/utils/form-validation';
import { toUpperAlpha, UppercaseInputDirective } from '../../../shared/uppercase-input.directive';

interface ItemOption {
  _id: string;
  label: string;
  defaultRate?: number | null;
}

type PurchaseItemForm = FormGroup<{
  item: FormControl<string>;
  quantity: FormControl<number | null>;
  rate: FormControl<number | null>;
}>;

@Component({
  selector: 'app-purchases-page',
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
    Textarea,
    UppercaseInputDirective,
  ],
  templateUrl: './purchases-page.html',
})
export class PurchasesPage {
  private readonly api = inject(PurchaseService);
  private readonly distributorsApi = inject(DistributorService);
  private readonly itemsApi = inject(ItemService);
  private readonly fb = inject(FormBuilder);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly queryClient = injectQueryClient();

  readonly dialogVisible = signal(false);
  readonly editingId = signal<string | null>(null);

  readonly payNowOptions = [
    { label: 'No', value: false },
    { label: 'Yes', value: true },
  ];

  fromDate: Date = startOfMonth(new Date());
  toDate: Date = endOfMonth(new Date());
  distributorId: string | null = null;

  private readonly fromFilter = signal(toIsoDate(this.fromDate));
  private readonly toFilter = signal(toIsoDate(this.toDate));
  private readonly distributorFilter = signal<string | undefined>(undefined);
  private readonly searched = signal(true);

  readonly distributorsQuery = injectQuery(() => ({
    queryKey: queryKeys.distributors.list(),
    queryFn: () => lastValueFrom(this.distributorsApi.list()),
    staleTime: STALE.distributors,
  }));

  readonly itemsQuery = injectQuery(() => ({
    queryKey: queryKeys.items.list(),
    queryFn: () => lastValueFrom(this.itemsApi.list()),
    staleTime: STALE.items,
  }));

  readonly purchasesQuery = injectQuery(() => {
    const filters = {
      distributor: this.distributorFilter(),
      from: this.fromFilter(),
      to: this.toFilter(),
    };
    return {
      queryKey: queryKeys.purchases.list(filters),
      queryFn: () => lastValueFrom(this.api.list(filters)),
      staleTime: STALE.purchases,
      enabled: this.searched(),
    };
  });

  readonly distributors = computed(() =>
    (this.distributorsQuery.data() ?? []).map((row) => ({
      _id: row._id,
      label: distributorOptionLabel(row),
    })),
  );
  readonly stockItems = computed(() =>
    (this.itemsQuery.data() ?? []).map((row) => this.toItemOption(row)),
  );
  readonly rows = computed(() => this.purchasesQuery.data() ?? []);
  readonly loading = computed(
    () => this.searched() && this.purchasesQuery.isPending() && !this.purchasesQuery.data(),
  );

  readonly form = this.fb.nonNullable.group({
    distributor: ['', Validators.required],
    purchaseDate: [new Date() as Date, Validators.required],
    invoiceNumber: [''],
    remarks: [''],
    payNow: [false],
    paymentParticular: [''],
    paymentAmount: [null as number | null],
    items: this.fb.array<PurchaseItemForm>([this.createItemGroup()]),
  });

  private readonly formTick = signal(0);

  readonly totalAmount = computed(() => {
    this.formTick();
    return this.items.controls.reduce((sum, group) => sum + this.lineAmount(group), 0);
  });

  readonly saveMutation = injectMutation(() => ({
    mutationFn: (input: {
      id: string | null;
      payload: {
        distributor: string;
        purchaseDate: string;
        invoiceNumber?: string;
        items: Array<{ item: string; quantity: number; rate: number; amount: number }>;
        totalAmount: number;
        remarks?: string;
        recordPayment?: boolean;
        paymentParticular?: string;
        paymentAmount?: number;
      };
      payNow: boolean;
    }) =>
      lastValueFrom(
        input.id ? this.api.update(input.id, input.payload) : this.api.create(input.payload),
      ),
    onSuccess: async (_data, input) => {
      await invalidateAfter.purchase(this.queryClient);
      this.dialogVisible.set(false);
      this.messages.add({
        severity: 'success',
        summary: input.id ? 'Purchase updated' : 'Purchase recorded',
        detail: input.payNow
          ? 'Purchase and payment posted to distributor account.'
          : 'Amount posted to distributor account. Pay via Account Entry.',
      });
    },
    onError: (err) => {
      this.messages.add({
        severity: 'error',
        summary: 'Could not save purchase',
        detail: apiErrorMessage(err),
      });
    },
  }));

  readonly deleteMutation = injectMutation(() => ({
    mutationFn: (id: string) => lastValueFrom(this.api.remove(id)),
    onSuccess: async () => {
      await invalidateAfter.purchase(this.queryClient);
      this.messages.add({ severity: 'success', summary: 'Purchase deleted' });
    },
    onError: (err) => {
      this.messages.add({
        severity: 'error',
        summary: 'Could not delete purchase',
        detail: apiErrorMessage(err),
      });
    },
  }));

  readonly saving = computed(() => this.saveMutation.isPending());

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.bumpFormTick();
    });
  }

  get items(): FormArray<PurchaseItemForm> {
    return this.form.controls.items;
  }

  addItem(): void {
    this.items.push(this.createItemGroup());
    this.bumpFormTick();
  }

  removeItem(index: number): void {
    if (this.items.length <= 1) return;
    this.items.removeAt(index);
    this.bumpFormTick();
  }

  onItemChange(index: number): void {
    const group = this.items.at(index);
    const itemId = group.controls.item.value;
    const selected = this.stockItems().find((row) => row._id === itemId);
    if (!selected?.defaultRate) return;
    const rate = group.controls.rate.value;
    if (rate == null || rate === 0) {
      group.controls.rate.setValue(selected.defaultRate);
      this.bumpFormTick();
    }
  }

  resetCurrentMonth(): void {
    const now = new Date();
    this.fromDate = startOfMonth(now);
    this.toDate = endOfMonth(now);
    this.search();
  }

  search(): void {
    this.fromFilter.set(toIsoDate(this.fromDate));
    this.toFilter.set(toIsoDate(this.toDate));
    this.distributorFilter.set(this.distributorId || undefined);
    this.searched.set(true);
  }

  openCreate(): void {
    this.editingId.set(null);
    this.form.reset({
      distributor: '',
      purchaseDate: new Date(),
      invoiceNumber: '',
      remarks: '',
      payNow: false,
      paymentParticular: '',
      paymentAmount: null,
    });
    this.resetItems([this.createItemGroup()]);
    this.bumpFormTick();
    this.dialogVisible.set(true);
  }

  openEdit(row: Purchase): void {
    this.editingId.set(row._id);
    this.form.reset({
      distributor:
        typeof row.distributor === 'object' && row.distributor
          ? row.distributor._id
          : String(row.distributor),
      purchaseDate: new Date(row.purchaseDate),
      invoiceNumber: row.invoiceNumber || '',
      remarks: row.remarks || '',
      payNow: false,
      paymentParticular: '',
      paymentAmount: null,
    });
    this.resetItems(row.items.map((item) => this.createItemGroup(item)));
    this.bumpFormTick();
    this.dialogVisible.set(true);
  }

  confirmDelete(row: Purchase): void {
    this.confirm.confirm({
      header: 'Delete purchase?',
      message: `Remove purchase of ${this.formatAmount(row.totalAmount)} from ${this.distributorName(row)}? The linked account entry will also be removed.`,
      icon: 'pi pi-trash',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptIcon: 'pi pi-trash',
      accept: () => this.deleteMutation.mutate(row._id),
    });
  }

  save(): void {
    (document.activeElement as HTMLElement | null)?.blur?.();
    this.form.markAllAsTouched();

    const distributor = this.form.controls.distributor.value;
    if (!distributor) {
      toastMissingRequired(this.messages);
      return;
    }

    const purchaseDate = this.form.controls.purchaseDate.value;
    if (!purchaseDate) {
      toastMissingRequired(this.messages);
      return;
    }

    const items = this.buildNormalizedItems();
    if (!items) return;

    const id = this.editingId();
    const total = items.reduce((sum, item) => sum + item.amount, 0);
    const v = this.form.getRawValue();

    const payNow = !id && Boolean(v.payNow);
    if (payNow) {
      const paymentAmount = Number(v.paymentAmount);
      if (!v.paymentParticular.trim()) {
        this.messages.add({
          severity: 'warn',
          summary: 'Payment particulars required',
          detail: 'Enter payment particulars when Pay Now is Yes.',
        });
        return;
      }
      if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
        this.messages.add({
          severity: 'warn',
          summary: 'Payment amount required',
          detail: 'Enter a payment amount greater than zero.',
        });
        return;
      }
    }

    const payload = {
      distributor,
      purchaseDate: toIsoDate(purchaseDate),
      invoiceNumber: v.invoiceNumber.trim() ? toUpperAlpha(v.invoiceNumber.trim()) : undefined,
      items,
      totalAmount: total,
      remarks: v.remarks.trim() ? toUpperAlpha(v.remarks.trim()) : undefined,
      ...(payNow
        ? {
            recordPayment: true,
            paymentParticular: toUpperAlpha(v.paymentParticular.trim()),
            paymentAmount: Number(v.paymentAmount),
          }
        : {}),
    };

    this.saveMutation.mutate({ id, payload, payNow });
  }

  distributorName(row: Purchase): string {
    if (typeof row.distributor === 'object' && row.distributor) {
      return row.distributor.company
        ? `${row.distributor.name} (${row.distributor.company})`
        : row.distributor.name;
    }
    return '—';
  }

  itemName(line: PurchaseItem): string {
    if (typeof line.item === 'object' && line.item) {
      return line.item.unit ? `${line.item.name} (${line.item.unit})` : line.item.name;
    }
    return 'Item';
  }

  itemSummary(row: Purchase): string {
    if (!row.items?.length) return '—';
    const first = this.itemName(row.items[0]);
    return row.items.length > 1 ? `${first} +${row.items.length - 1} more` : first;
  }

  lineAmount(group: PurchaseItemForm): number {
    const qty = Number(group.controls.quantity.value);
    const rate = Number(group.controls.rate.value);
    if (!Number.isFinite(qty) || !Number.isFinite(rate)) return 0;
    return qty * rate;
  }

  formatAmount(value: number): string {
    return formatCurrency(value);
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleDateString();
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

  private buildExportTable() {
    const purchases = this.rows();
    if (!purchases.length) {
      this.messages.add({
        severity: 'warn',
        summary: 'Nothing to export',
        detail: 'Apply filters to load purchases first.',
      });
      return null;
    }

    const headers = [
      'Date',
      'Distributor',
      'Invoice',
      'Item',
      'Qty',
      'Rate',
      'Line amount',
      'Total',
      'Remarks',
    ];
    const rows: ExportCell[][] = [];

    for (const purchase of purchases) {
      const items = purchase.items?.length ? purchase.items : [null];
      items.forEach((line, index) => {
        rows.push([
          index === 0 ? this.formatDate(purchase.purchaseDate) : '',
          index === 0 ? this.distributorName(purchase) : '',
          index === 0 ? purchase.invoiceNumber || '' : '',
          line ? this.itemName(line) : '',
          line ? line.quantity : '',
          line ? line.rate : '',
          line ? line.amount : '',
          index === 0 ? purchase.totalAmount : '',
          index === 0 ? purchase.remarks || '' : '',
        ]);
      });
    }

    const from = this.fromFilter() || toIsoDate(this.fromDate);
    const to = this.toFilter() || toIsoDate(this.toDate);

    return {
      title: 'Purchases report',
      subtitle: `${from} to ${to} · ${purchases.length} purchases`,
      headers,
      rows,
      filename: `purchases-${from}-${to}`,
    };
  }

  private createItemGroup(item?: PurchaseItem) {
    const itemId =
      item && typeof item.item === 'object' && item.item
        ? item.item._id
        : item
          ? String(item.item)
          : '';
    return this.fb.group({
      item: [itemId, Validators.required],
      quantity: [item?.quantity ?? null, [Validators.required, Validators.min(0.01)]],
      rate: [item?.rate ?? null, [Validators.required, Validators.min(0)]],
    }) as PurchaseItemForm;
  }

  private buildNormalizedItems():
    | Array<{ item: string; quantity: number; rate: number; amount: number }>
    | null {
    const items: Array<{ item: string; quantity: number; rate: number; amount: number }> = [];

    for (const group of this.items.controls) {
      const itemId = group.controls.item.value?.trim() ?? '';
      const quantity = Number(group.controls.quantity.value);
      const rate = Number(group.controls.rate.value);

      if (!itemId) {
        this.messages.add({ severity: 'warn', summary: 'Select an item for each line' });
        return null;
      }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        this.messages.add({
          severity: 'warn',
          summary: 'Invalid quantity',
          detail: 'Each line needs a quantity greater than zero.',
        });
        return null;
      }
      if (!Number.isFinite(rate) || rate < 0) {
        this.messages.add({
          severity: 'warn',
          summary: 'Invalid rate',
          detail: 'Each line needs a valid rate.',
        });
        return null;
      }

      items.push({ item: itemId, quantity, rate, amount: quantity * rate });
    }

    if (items.length === 0) {
      this.messages.add({ severity: 'warn', summary: 'Add at least one item' });
      return null;
    }

    return items;
  }

  private resetItems(groups: PurchaseItemForm[]): void {
    this.form.setControl('items', this.fb.array(groups));
  }

  bumpFormTick(): void {
    this.formTick.update((value) => value + 1);
  }

  private toItemOption(row: Item): ItemOption {
    return {
      _id: row._id,
      label: row.unit ? `${row.name} (${row.unit})` : row.name,
      defaultRate: row.defaultRate,
    };
  }
}
