import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { Checkbox } from 'primeng/checkbox';
import { ConsumerService } from '../../../core/services/api/consumer.service';
import { DacService } from '../../../core/services/api/dac.service';
import { DistributorService } from '../../../core/services/api/distributor.service';
import { PreferencesService } from '../../../core/services/preferences.service';
import {
  Consumer,
  ConsumerLookupResult,
  CreateDacPayload,
  Dac,
  Distributor,
} from '../../../core/models/gms.models';
import { apiErrorMessage } from '../../../core/utils/api-error';
import { formatCurrency } from '../../../core/utils/account-balance';
import { toIsoDate } from '../../../core/utils/date';
import { toastMissingRequired } from '../../../core/utils/form-validation';

type LookupState = 'idle' | 'found' | 'missing';

interface DistributorOption {
  _id: string;
  name: string;
  label: string;
}

interface IncompleteConsumerFields {
  fatherName: boolean;
  phone: boolean;
  address: boolean;
}

@Component({
  selector: 'app-dac-entry',
  imports: [
    ReactiveFormsModule,
    Button,
    DatePicker,
    InputNumber,
    InputText,
    Select,
    Textarea,
    Checkbox,
  ],
  templateUrl: './dac-entry.html',
  styleUrl: './dac-entry.css',
})
export class DacEntryPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly distributorsApi = inject(DistributorService);
  private readonly consumersApi = inject(ConsumerService);
  private readonly dacsApi = inject(DacService);
  private readonly prefs = inject(PreferencesService);
  private readonly messages = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly distributors = signal<DistributorOption[]>([]);
  readonly lookupState = signal<LookupState>('idle');
  readonly lookupResult = signal<ConsumerLookupResult | null>(null);
  readonly lookingUp = signal(false);
  readonly submitting = signal(false);
  readonly intervalBlocked = signal(false);
  readonly recentDacs = signal<Dac[]>([]);
  readonly loadingRecent = signal(false);
  readonly incompleteConsumerFields = signal<IncompleteConsumerFields>({
    fatherName: false,
    phone: false,
    address: false,
  });

  readonly paymentMethods = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Other'];

  readonly hasIncompleteConsumerFields = computed(() => {
    const fields = this.incompleteConsumerFields();
    return fields.fatherName || fields.phone || fields.address;
  });

  readonly form = this.fb.nonNullable.group({
    distributorId: ['', Validators.required],
    bookingDistributorId: ['', Validators.required],
    consumerNumber: ['', Validators.required],
    consumerName: [''],
    fatherName: [''],
    phone: [''],
    address: [''],
    dacNumber: ['', Validators.required],
    dacDate: [new Date() as Date, Validators.required],
    amount: [null as number | null, Validators.required],
    paymentMethod: ['Cash', Validators.required],
    deliveryDone: [false],
    intervalDays: [25, [Validators.required, Validators.min(1)]],
    remarks: [''],
  });

  private readonly dacDateValue = toSignal(
    this.form.controls.dacDate.valueChanges.pipe(
      startWith(this.form.controls.dacDate.value),
    ),
    { initialValue: this.form.controls.dacDate.value },
  );

  private readonly intervalValue = toSignal(
    this.form.controls.intervalDays.valueChanges.pipe(
      startWith(this.form.controls.intervalDays.value),
    ),
    { initialValue: this.form.controls.intervalDays.value },
  );

  /** Next refill date after this DAC (DAC date excluded from the interval span). */
  readonly projectedNextDate = computed(() => {
    const date = this.dacDateValue();
    const days = Number(this.intervalValue());
    if (!date || !Number.isFinite(days) || days < 1) return null;
    return this.addDaysExclusive(new Date(date), days);
  });

  ngOnInit(): void {
    this.loadRecent();
    this.distributorsApi.list().subscribe({
      next: (rows) => {
        const options = rows.map((row) => this.toOption(row));
        this.distributors.set(options);

        const consumerDefault = this.prefs.defaultConsumerDistributorId();
        const bookingDefault = this.prefs.defaultBookingDistributorId();
        const firstId = options[0]?._id || '';

        const consumerId =
          (consumerDefault && options.some((o) => o._id === consumerDefault)
            ? consumerDefault
            : firstId) || '';
        const bookingId =
          (bookingDefault && options.some((o) => o._id === bookingDefault)
            ? bookingDefault
            : consumerId) || '';

        if (consumerId) this.form.controls.distributorId.setValue(consumerId);
        if (bookingId) this.form.controls.bookingDistributorId.setValue(bookingId);
      },
      error: (err) => this.toastError(err),
    });

    this.form.controls.distributorId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.resetLookup());
    this.form.controls.consumerNumber.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.lookupState() !== 'idle') {
          this.resetLookup();
        }
      });
  }

  isDefaultConsumerDistributor(id: string): boolean {
    return this.prefs.defaultConsumerDistributorId() === id;
  }

  isDefaultBookingDistributor(id: string): boolean {
    return this.prefs.defaultBookingDistributorId() === id;
  }

  setDefaultConsumerDistributor(): void {
    const id = this.form.controls.distributorId.value;
    if (!id) return;
    this.prefs.setDefaultConsumerDistributor(id);
    this.messages.add({
      severity: 'success',
      summary: 'Default saved',
      detail: 'Consumer distributor set as default',
    });
  }

  setDefaultBookingDistributor(): void {
    const id = this.form.controls.bookingDistributorId.value;
    if (!id) return;
    this.prefs.setDefaultBookingDistributor(id);
    this.messages.add({
      severity: 'success',
      summary: 'Default saved',
      detail: 'DAC booking distributor set as default',
    });
  }

  lookup(): void {
    const distributorId = this.form.controls.distributorId.value;
    const consumerNumber = this.form.controls.consumerNumber.value.trim();

    if (!distributorId || !consumerNumber) {
      this.form.controls.distributorId.markAsTouched();
      this.form.controls.consumerNumber.markAsTouched();
      toastMissingRequired(this.messages);
      return;
    }

    this.lookingUp.set(true);
    this.consumersApi.lookup(distributorId, consumerNumber).subscribe({
      next: (result) => {
        this.lookingUp.set(false);
        this.lookupResult.set(result);
        this.form.patchValue({
          consumerName: '',
          fatherName: '',
          phone: '',
          address: '',
        });
        if (result.found && result.consumer) {
          this.lookupState.set('found');
          this.form.controls.consumerName.clearValidators();
          this.setIncompleteConsumerFields(result.consumer);
          this.applyIntervalGate(result);
        } else {
          this.lookupState.set('missing');
          this.intervalBlocked.set(false);
          this.incompleteConsumerFields.set({
            fatherName: true,
            phone: true,
            address: true,
          });
          this.form.controls.consumerName.setValidators([Validators.required]);
        }
        this.form.controls.consumerName.updateValueAndValidity();
        queueMicrotask(() => {
          const el = document.getElementById(
            result.found
              ? this.hasIncompleteConsumerFields()
                ? this.firstIncompleteFieldId()
                : 'dacNumber'
              : 'consumerName',
          );
          el?.focus();
        });
      },
      error: (err) => {
        this.lookingUp.set(false);
        this.toastError(err);
      },
    });
  }

  submit(): void {
    if (this.lookupState() === 'idle') {
      this.messages.add({
        severity: 'warn',
        summary: 'Lookup required',
        detail: 'Look up the consumer number before saving a DAC',
      });
      return;
    }

    if (this.intervalBlocked()) {
      this.messages.add({
        severity: 'error',
        summary: 'Interval not elapsed',
        detail: 'This consumer is not eligible for a new DAC yet',
      });
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      toastMissingRequired(this.messages);
      return;
    }

    const v = this.form.getRawValue();
    const consumerPayload = this.buildConsumerPayload(v);
    const payload = {
      distributorId: v.distributorId,
      bookingDistributorId: v.bookingDistributorId,
      consumerNumber: v.consumerNumber.trim(),
      dacNumber: v.dacNumber.trim(),
      dacDate: toIsoDate(v.dacDate),
      amount: Number(v.amount),
      paymentMethod: v.paymentMethod,
      deliveryDone: v.deliveryDone,
      intervalDays: Number(v.intervalDays),
      remarks: v.remarks.trim() || undefined,
      ...(consumerPayload ? { consumer: consumerPayload } : {}),
    };

    this.submitting.set(true);
    this.dacsApi.create(payload).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.messages.add({
          severity: 'success',
          summary: 'DAC saved',
          detail: res.consumerCreated
            ? 'Consumer created and DAC booked'
            : 'DAC entry created',
        });
        this.resetAfterSuccess();
      },
      error: (err) => {
        this.submitting.set(false);
        if (err?.status === 409 && err?.error?.nextEligibleDate) {
          this.intervalBlocked.set(true);
          this.messages.add({
            severity: 'error',
            summary: 'Too early',
            detail: err.error.message,
          });
          return;
        }
        if (err?.error?.requiresConsumerInfo) {
          this.lookupState.set('missing');
          this.form.controls.consumerName.setValidators([Validators.required]);
          this.form.controls.consumerName.updateValueAndValidity();
        }
        this.toastError(err);
      },
    });
  }

  consumerSummary(consumer: Consumer | null): string {
    if (!consumer) return '';
    return [consumer.name, consumer.phone, consumer.address].filter(Boolean).join(' · ');
  }

  formatDate(value: string | Date | null): string {
    if (!value) return '—';
    return new Date(value).toLocaleDateString();
  }

  formatAmount(value: number): string {
    return formatCurrency(value);
  }

  consumerLabel(dac: Dac): string {
    if (typeof dac.consumer === 'object' && dac.consumer) {
      return `${dac.consumer.consumerNumber} · ${dac.consumer.name}`;
    }
    return '—';
  }

  loadRecent(): void {
    this.loadingRecent.set(true);
    this.dacsApi.list({ limit: 5 }).subscribe({
      next: (rows) => {
        this.recentDacs.set(rows);
        this.loadingRecent.set(false);
      },
      error: () => this.loadingRecent.set(false),
    });
  }

  onFormKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.tagName === 'TEXTAREA') return;
    if (target.closest('button, a, [role="button"]')) return;

    if (this.lookupState() === 'idle') {
      event.preventDefault();
      this.lookup();
      return;
    }

    if (target.getAttribute('formcontrolname') === 'consumerNumber') {
      event.preventDefault();
      this.lookup();
    }
  }

  private toOption(row: Distributor): DistributorOption {
    return {
      _id: row._id,
      name: row.name,
      label: row.company ? `${row.name} (${row.company})` : row.name,
    };
  }

  private applyIntervalGate(result: ConsumerLookupResult): void {
    if (!result.nextEligibleDate) {
      this.intervalBlocked.set(false);
      return;
    }
    const eligible = new Date(result.nextEligibleDate);
    eligible.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    this.intervalBlocked.set(today < eligible);
  }

  private resetLookup(): void {
    this.lookupState.set('idle');
    this.lookupResult.set(null);
    this.intervalBlocked.set(false);
    this.incompleteConsumerFields.set({
      fatherName: false,
      phone: false,
      address: false,
    });
    this.form.controls.consumerName.clearValidators();
    this.form.controls.consumerName.updateValueAndValidity();
  }

  private setIncompleteConsumerFields(consumer: Consumer): void {
    this.incompleteConsumerFields.set({
      fatherName: !consumer.fatherName?.trim(),
      phone: !consumer.phone?.trim(),
      address: !consumer.address?.trim(),
    });
  }

  private firstIncompleteFieldId(): string {
    const fields = this.incompleteConsumerFields();
    if (fields.fatherName) return 'fatherName';
    if (fields.phone) return 'phone';
    if (fields.address) return 'address';
    return 'dacNumber';
  }

  private buildConsumerPayload(v: {
    consumerName: string;
    fatherName: string;
    phone: string;
    address: string;
  }): CreateDacPayload['consumer'] | null {
    if (this.lookupState() === 'missing') {
      return {
        name: v.consumerName.trim(),
        fatherName: v.fatherName.trim() || undefined,
        phone: v.phone.trim() || undefined,
        address: v.address.trim() || undefined,
      };
    }

    if (this.lookupState() !== 'found' || !this.hasIncompleteConsumerFields()) {
      return null;
    }

    const incomplete = this.incompleteConsumerFields();
    const updates: NonNullable<CreateDacPayload['consumer']> = {};
    if (incomplete.fatherName && v.fatherName.trim()) {
      updates.fatherName = v.fatherName.trim();
    }
    if (incomplete.phone && v.phone.trim()) {
      updates.phone = v.phone.trim();
    }
    if (incomplete.address && v.address.trim()) {
      updates.address = v.address.trim();
    }
    return Object.keys(updates).length ? updates : null;
  }

  private resetAfterSuccess(): void {
    const distributorId = this.form.controls.distributorId.value;
    const bookingDistributorId = this.form.controls.bookingDistributorId.value;
    this.form.reset({
      distributorId,
      bookingDistributorId,
      consumerNumber: '',
      consumerName: '',
      fatherName: '',
      phone: '',
      address: '',
      dacNumber: '',
      dacDate: new Date(),
      amount: null,
      paymentMethod: 'Cash',
      deliveryDone: false,
      intervalDays: 25,
      remarks: '',
    });
    this.resetLookup();
    this.loadRecent();
    queueMicrotask(() => document.getElementById('consumerNumber')?.focus());
  }

  /** Interval days after DAC date, excluding the DAC date itself. */
  private addDaysExclusive(date: Date, days: number): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    result.setDate(result.getDate() + days);
    return result;
  }

  private toastError(err: unknown): void {
    this.messages.add({
      severity: 'error',
      summary: 'Request failed',
      detail: apiErrorMessage(err, 'Something went wrong'),
    });
  }
}
