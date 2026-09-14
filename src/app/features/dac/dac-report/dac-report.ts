import { Component, computed, inject, OnInit, signal } from '@angular/core';
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
import { Dac } from '../../../core/models/gms.models';
import { DacService } from '../../../core/services/api/dac.service';
import { DistributorService } from '../../../core/services/api/distributor.service';
import { apiErrorMessage } from '../../../core/utils/api-error';
import { dacBookingLabel, distributorOptionLabel } from '../../../core/utils/distributor';
import { toIsoDate } from '../../../core/utils/date';
import { downloadCsv, downloadPdf } from '../../../core/utils/export-report';
import { toastMissingRequired } from '../../../core/utils/form-validation';

interface DistributorOption {
  _id: string;
  label: string;
}

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
  ],
  templateUrl: './dac-report.html',
})
export class DacReportPage implements OnInit {
  private readonly dacsApi = inject(DacService);
  private readonly distributorsApi = inject(DistributorService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly distributorOptions = signal<DistributorOption[]>([]);
  readonly rows = signal<Dac[]>([]);
  readonly loading = signal(false);
  readonly dialogVisible = signal(false);
  readonly saving = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly editingConsumerLabel = signal('');

  readonly paymentMethods = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Other'];

  fromDate: Date = this.startOfToday();
  toDate: Date = this.startOfToday();
  distributorId: string | null = null;

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

  readonly totalAmount = computed(() =>
    this.rows().reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
  );

  readonly deliveredCount = computed(
    () => this.rows().filter((row) => row.deliveryDone).length,
  );

  consumerNumberFilter: string | null = null;

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;
    const distributor = qp.get('distributor');
    const consumerNumber = qp.get('consumerNumber');
    if (distributor) this.distributorId = distributor;
    if (consumerNumber) this.consumerNumberFilter = consumerNumber;

    this.distributorsApi.list().subscribe({
      next: (rows) =>
        this.distributorOptions.set(
          rows.map((row) => ({
            _id: row._id,
            label: distributorOptionLabel(row),
          })),
        ),
    });
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

    this.loading.set(true);
    this.dacsApi
      .list({
        from: toIsoDate(this.fromDate),
        to: toIsoDate(this.toDate),
        distributor: this.distributorId || undefined,
        consumerNumber: this.consumerNumberFilter || undefined,
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
            summary: 'Failed to load DAC report',
            detail: apiErrorMessage(err),
          });
        },
      });
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
      accept: () => this.remove(row._id),
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
    this.saving.set(true);
    this.dacsApi
      .update(id, {
        bookingDistributorId: v.bookingDistributorId,
        dacNumber: v.dacNumber.trim(),
        dacDate: toIsoDate(v.dacDate),
        amount: Number(v.amount),
        paymentMethod: v.paymentMethod,
        deliveryDone: v.deliveryDone,
        intervalDays: Number(v.intervalDays),
        remarks: v.remarks.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.dialogVisible.set(false);
          this.messages.add({ severity: 'success', summary: 'DAC updated' });
          this.search();
        },
        error: (err) => {
          this.saving.set(false);
          this.messages.add({
            severity: 'error',
            summary: 'Could not update DAC',
            detail: err?.error?.message || 'Request failed',
          });
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

    return {
      title: 'DAC Report',
      subtitle: `${toIsoDate(this.fromDate)} to ${toIsoDate(this.toDate)} · ${rows.length} DACs · Total ${this.formatAmount(this.totalAmount())}`,
      headers: [
        'DAC date',
        'Next date',
        'DAC no.',
        'Consumer',
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
        this.consumerLabel(row),
        this.distributorLabel(row),
        row.paymentMethod,
        row.amount,
        row.deliveryDone ? 'Delivered' : 'Pending',
        row.remarks || '',
      ]),
      filename: `dac-report-${toIsoDate(this.fromDate)}-${toIsoDate(this.toDate)}`,
    };
  }

  private remove(id: string): void {
    this.dacsApi.remove(id).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: 'DAC deleted' });
        this.search();
      },
      error: (err) => {
        this.messages.add({
          severity: 'error',
          summary: 'Could not delete DAC',
          detail: err?.error?.message || 'Request failed',
        });
      },
    });
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
