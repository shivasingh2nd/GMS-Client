import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
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
import { Item, Purchase, PurchaseItem } from '../../../core/models/gms.models';
import { DistributorService } from '../../../core/services/api/distributor.service';
import { ItemService } from '../../../core/services/api/item.service';
import { PurchaseService } from '../../../core/services/api/purchase.service';
import { apiErrorMessage } from '../../../core/utils/api-error';
import { formatCurrency } from '../../../core/utils/account-balance';
import { distributorOptionLabel } from '../../../core/utils/distributor';
import { endOfMonth, startOfMonth, toIsoDate } from '../../../core/utils/date';
import { downloadCsv, downloadPdf, ExportCell } from '../../../core/utils/export-report';
import { toastMissingRequired } from '../../../core/utils/form-validation';

interface DistributorOption {
  _id: string;
  label: string;
}

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
  ],
  templateUrl: './purchases-page.html',
})
export class PurchasesPage implements OnInit {
  private readonly api = inject(PurchaseService);
  private readonly distributorsApi = inject(DistributorService);
  private readonly itemsApi = inject(ItemService);
  private readonly fb = inject(FormBuilder);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly rows = signal<Purchase[]>([]);
  readonly distributors = signal<DistributorOption[]>([]);
  readonly stockItems = signal<ItemOption[]>([]);
  readonly loading = signal(false);
  readonly dialogVisible = signal(false);
  readonly saving = signal(false);
  readonly editingId = signal<string | null>(null);

  readonly payNowOptions = [
    { label: 'No', value: false },
    { label: 'Yes', value: true },
  ];

  fromDate: Date = startOfMonth(new Date());
  toDate: Date = endOfMonth(new Date());
  distributorId: string | null = null;

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

  ngOnInit(): void {
    this.distributorsApi.list().subscribe({
      next: (rows) =>
        this.distributors.set(
          rows.map((row) => ({ _id: row._id, label: distributorOptionLabel(row) })),
        ),
    });
    this.itemsApi.list().subscribe({
      next: (rows) => this.stockItems.set(rows.map((row) => this.toItemOption(row))),
    });
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.bumpFormTick();
    });
    this.search();
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
    this.loading.set(true);
    this.api
      .list({
        distributor: this.distributorId || undefined,
        from: toIsoDate(this.fromDate),
        to: toIsoDate(this.toDate),
      })
      .subscribe({
        next: (rows) => {
          this.rows.set(rows);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.messages.add({
            severity: 'error',
            summary: 'Failed to load purchases',
            detail: apiErrorMessage(err),
          });
        },
      });
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
      accept: () => this.remove(row._id),
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
      invoiceNumber: v.invoiceNumber.trim() || undefined,
      items,
      totalAmount: total,
      remarks: v.remarks.trim() || undefined,
      ...(payNow
        ? {
            recordPayment: true,
            paymentParticular: v.paymentParticular.trim(),
            paymentAmount: Number(v.paymentAmount),
          }
        : {}),
    };

    this.saving.set(true);
    const request = id ? this.api.update(id, payload) : this.api.create(payload);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogVisible.set(false);
        this.messages.add({
          severity: 'success',
          summary: id ? 'Purchase updated' : 'Purchase recorded',
          detail: payNow
            ? 'Purchase and payment posted to distributor account.'
            : 'Amount posted to distributor account. Pay via Account Entry.',
        });
        this.search();
      },
      error: (err) => {
        this.saving.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'Could not save purchase',
          detail: apiErrorMessage(err),
        });
      },
    });
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

    return {
      title: 'Purchases report',
      subtitle: `${toIsoDate(this.fromDate)} to ${toIsoDate(this.toDate)} · ${purchases.length} purchases`,
      headers,
      rows,
      filename: `purchases-${toIsoDate(this.fromDate)}-${toIsoDate(this.toDate)}`,
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

  private remove(id: string): void {
    this.api.remove(id).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: 'Purchase deleted' });
        this.search();
      },
      error: (err) => {
        this.messages.add({
          severity: 'error',
          summary: 'Could not delete purchase',
          detail: apiErrorMessage(err),
        });
      },
    });
  }
}
