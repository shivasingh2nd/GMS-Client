import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';
import { Checkbox } from 'primeng/checkbox';
import { lastValueFrom } from 'rxjs';
import { Dac } from '../../../core/models/gms.models';
import { DacService } from '../../../core/services/api/dac.service';
import { DistributorService } from '../../../core/services/api/distributor.service';
import {
  injectMutation,
  injectQuery,
  injectQueryClient,
  invalidateAfter,
  queryKeys,
  STALE,
} from '../../../core/query';
import { apiErrorMessage } from '../../../core/utils/api-error';
import { dacBookingLabel, distributorOptionLabel } from '../../../core/utils/distributor';
import { toIsoDate } from '../../../core/utils/date';
import { downloadCsv, downloadPdf } from '../../../core/utils/export-report';
import { toastMissingRequired } from '../../../core/utils/form-validation';
import { toUpperAlpha, UppercaseInputDirective } from '../../../shared/uppercase-input.directive';

@Component({
  selector: 'app-dac-report',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    Button,
    DatePicker,
    Dialog,
    InputNumber,
    InputText,
    Select,
    TableModule,
    Tag,
    Textarea,
    Checkbox,
    UppercaseInputDirective,
  ],
  templateUrl: './dac-report.html',
})
export class DacReportPage {
  private readonly dacsApi = inject(DacService);
  private readonly distributorsApi = inject(DistributorService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  private readonly queryClient = injectQueryClient();

  readonly dialogVisible = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly editingConsumerLabel = signal('');

  readonly paymentMethods = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Other'];

  fromDate: Date = this.startOfToday();
  toDate: Date = this.startOfToday();
  distributorId: string | null = null;
  consumerNumberFilter: string | null = null;

  private readonly fromFilter = signal('');
  private readonly toFilter = signal('');
  private readonly distributorFilter = signal<string | undefined>(undefined);
  private readonly consumerNumberQueryFilter = signal<string | undefined>(undefined);
  private readonly searched = signal(false);

  readonly distributorsQuery = injectQuery(() => ({
    queryKey: queryKeys.distributors.list(),
    queryFn: () => lastValueFrom(this.distributorsApi.list()),
    staleTime: STALE.distributors,
  }));

  readonly dacsQuery = injectQuery(() => {
    const filters = {
      from: this.fromFilter(),
      to: this.toFilter(),
      distributor: this.distributorFilter(),
      consumerNumber: this.consumerNumberQueryFilter(),
    };
    return {
      queryKey: queryKeys.dacs.list(filters),
      queryFn: () => lastValueFrom(this.dacsApi.list(filters)),
      staleTime: STALE.dacs,
      enabled: this.searched(),
    };
  });

  readonly distributorOptions = computed(() =>
    (this.distributorsQuery.data() ?? []).map((row) => ({
      _id: row._id,
      label: distributorOptionLabel(row),
    })),
  );
  readonly rows = computed(() => this.dacsQuery.data() ?? []);
  readonly loading = computed(
    () => this.searched() && this.dacsQuery.isPending() && !this.dacsQuery.data(),
  );

  readonly form = this.fb.nonNullable.group({
    bookingDistributorId: ['', Validators.required],
    dacNumber: ['', Validators.required],
    dacDate: [new Date() as Date, Validators.required],
    amount: [null as number | null, Validators.required],
    paymentMethod: ['Cash', Validators.required],
    deliveryDone: [false],
    intervalDays: [25, [Validators.required, Validators.min(1)]],
    remarks: [''],
  });

  readonly updateMutation = injectMutation(() => ({
    mutationFn: (input: {
      id: string;
      payload: {
        bookingDistributorId: string;
        dacNumber: string;
        dacDate: string;
        amount: number;
        paymentMethod: string;
        deliveryDone: boolean;
        intervalDays: number;
        remarks?: string;
      };
    }) => lastValueFrom(this.dacsApi.update(input.id, input.payload)),
    onSuccess: async () => {
      await invalidateAfter.dac(this.queryClient);
      this.dialogVisible.set(false);
      this.messages.add({ severity: 'success', summary: 'DAC updated' });
    },
    onError: (err) => {
      this.messages.add({
        severity: 'error',
        summary: 'Could not update DAC',
        detail: apiErrorMessage(err),
      });
    },
  }));

  readonly deleteMutation = injectMutation(() => ({
    mutationFn: (id: string) => lastValueFrom(this.dacsApi.remove(id)),
    onSuccess: async () => {
      await invalidateAfter.dac(this.queryClient);
      this.messages.add({ severity: 'success', summary: 'DAC deleted' });
    },
    onError: (err) => {
      this.messages.add({
        severity: 'error',
        summary: 'Could not delete DAC',
        detail: apiErrorMessage(err),
      });
    },
  }));

  readonly saving = computed(() => this.updateMutation.isPending());

  readonly totalAmount = computed(() =>
    this.rows().reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
  );

  readonly deliveredCount = computed(
    () => this.rows().filter((row) => row.deliveryDone).length,
  );

  constructor() {
    const qp = this.route.snapshot.queryParamMap;
    const distributor = qp.get('distributor');
    const consumerNumber = qp.get('consumerNumber');
    if (distributor) this.distributorId = distributor;
    if (consumerNumber) this.consumerNumberFilter = consumerNumber;
    this.search();
  }

  search(): void {
    if (!this.fromDate || !this.toDate) {
      this.messages.add({
        severity: 'warn',
        summary: 'Date range required',
        detail: 'Choose both from and to dates',
      });
      return;
    }

    if (this.startOfLocal(this.fromDate) > this.startOfLocal(this.toDate)) {
      this.messages.add({
        severity: 'warn',
        summary: 'Invalid range',
        detail: 'From date cannot be after to date',
      });
      return;
    }

    this.fromFilter.set(toIsoDate(this.fromDate));
    this.toFilter.set(toIsoDate(this.toDate));
    this.distributorFilter.set(this.distributorId || undefined);
    this.consumerNumberQueryFilter.set(this.consumerNumberFilter || undefined);
    this.searched.set(true);
  }

  resetToday(): void {
    this.fromDate = this.startOfToday();
    this.toDate = this.startOfToday();
    this.distributorId = null;
    this.consumerNumberFilter = null;
    this.search();
  }

  openEdit(row: Dac): void {
    this.editingId.set(row._id);
    this.editingConsumerLabel.set(this.consumerLabel(row));
    this.form.reset({
      bookingDistributorId: this.bookingDistributorId(row),
      dacNumber: row.dacNumber,
      dacDate: new Date(row.dacDate),
      amount: row.amount,
      paymentMethod: row.paymentMethod,
      deliveryDone: row.deliveryDone,
      intervalDays: row.intervalDays,
      remarks: row.remarks || '',
    });
    this.dialogVisible.set(true);
  }

  confirmDelete(row: Dac): void {
    this.confirm.confirm({
      header: 'Delete DAC?',
      message: `DAC “${row.dacNumber}” for ${this.consumerLabel(row)} will be hidden from reports.`,
      icon: 'pi pi-trash',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptIcon: 'pi pi-trash',
      accept: () => this.deleteMutation.mutate(row._id),
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      toastMissingRequired(this.messages);
      return;
    }
    const id = this.editingId();
    if (!id) return;

    const v = this.form.getRawValue();
    this.updateMutation.mutate({
      id,
      payload: {
        bookingDistributorId: v.bookingDistributorId,
        dacNumber: toUpperAlpha(v.dacNumber.trim()),
        dacDate: toIsoDate(v.dacDate),
        amount: Number(v.amount),
        paymentMethod: v.paymentMethod,
        deliveryDone: v.deliveryDone,
        intervalDays: Number(v.intervalDays),
        remarks: v.remarks.trim() ? toUpperAlpha(v.remarks.trim()) : undefined,
      },
    });
  }

  nextDate(row: Dac): Date | null {
    if (!row?.dacDate || !row?.intervalDays) return null;
    const date = new Date(row.dacDate);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + Number(row.intervalDays));
    return date;
  }

  consumerLabel(row: Dac): string {
    if (typeof row.consumer === 'object' && row.consumer) {
      return `${row.consumer.consumerNumber} · ${row.consumer.name}`;
    }
    return '—';
  }

  consumerNumber(row: Dac): string {
    return typeof row.consumer === 'object' && row.consumer
      ? row.consumer.consumerNumber
      : '—';
  }

  consumerName(row: Dac): string {
    return typeof row.consumer === 'object' && row.consumer ? row.consumer.name : '—';
  }

  distributorLabel(row: Dac): string {
    return dacBookingLabel(row);
  }

  bookingDistributorId(row: Dac): string {
    return typeof row.bookingInDistributor === 'object' && row.bookingInDistributor
      ? row.bookingInDistributor._id
      : String(row.bookingInDistributor);
  }

  formatDate(value: string | Date | null): string {
    if (!value) return '—';
    return new Date(value).toLocaleDateString();
  }

  formatAmount(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value || 0);
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
    const rows = this.rows();
    if (!rows.length) {
      this.messages.add({
        severity: 'warn',
        summary: 'Nothing to export',
        detail: 'Apply filters to load DAC rows first.',
      });
      return null;
    }

    const from = this.fromFilter() || toIsoDate(this.fromDate);
    const to = this.toFilter() || toIsoDate(this.toDate);

    return {
      title: 'DAC Report',
      subtitle: `${from} to ${to} · ${rows.length} DACs · Total ${this.formatAmount(this.totalAmount())}`,
      headers: [
        'DAC date',
        'Next date',
        'DAC no.',
        'Consumer no.',
        'Name',
        'Booking distributor',
        'Payment',
        'Amount',
        'Status',
        'Remarks',
      ],
      rows: rows.map((row) => [
        this.formatDate(row.dacDate),
        this.formatDate(this.nextDate(row)),
        row.dacNumber,
        this.consumerNumber(row),
        this.consumerName(row),
        this.distributorLabel(row),
        row.paymentMethod,
        row.amount,
        row.deliveryDone ? 'Delivered' : 'Pending',
        row.remarks || '',
      ]),
      filename: `dac-report-${from}-${to}`,
    };
  }

  private startOfToday(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private startOfLocal(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }
}
