import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { lastValueFrom } from 'rxjs';
import { AccountEntry, AccountEntryType, Party } from '../../../core/models/gms.models';
import { AccountEntryService } from '../../../core/services/api/account-entry.service';
import { PartyService } from '../../../core/services/api/party.service';
import {
  injectMutation,
  injectQuery,
  injectQueryClient,
  invalidateAfter,
  queryKeys,
  STALE,
} from '../../../core/query';
import { apiErrorMessage } from '../../../core/utils/api-error';
import {
  entryTypeLabel,
  formatAccountBalance,
  formatCurrency,
} from '../../../core/utils/account-balance';
import { toIsoDate } from '../../../core/utils/date';
import { toastMissingRequired } from '../../../core/utils/form-validation';
import { toUpperAlpha, UppercaseInputDirective } from '../../../shared/uppercase-input.directive';

@Component({
  selector: 'app-account-entry',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    Button,
    DatePicker,
    Dialog,
    InputNumber,
    InputText,
    Select,
    Textarea,
    UppercaseInputDirective,
  ],
  templateUrl: './account-entry.html',
})
export class AccountEntryPage {
  private readonly entriesApi = inject(AccountEntryService);
  private readonly partiesApi = inject(PartyService);
  private readonly fb = inject(FormBuilder);
  private readonly messages = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly queryClient = injectQueryClient();

  readonly partyDialogVisible = signal(false);

  readonly form = this.fb.nonNullable.group({
    partyId: ['', Validators.required],
    type: ['debit' as AccountEntryType, Validators.required],
    date: [new Date() as Date, Validators.required],
    amount: [null as number | null, Validators.required],
    particular: [''],
  });

  readonly partyForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    phone: [''],
    notes: [''],
    openingBalance: [0],
  });

  private readonly partyIdFilter = signal('');
  private readonly dateFilter = signal<string | null>(toIsoDate(new Date()));

  readonly partiesQuery = injectQuery(() => ({
    queryKey: queryKeys.parties.list(),
    queryFn: () => lastValueFrom(this.partiesApi.list()),
    staleTime: STALE.parties,
  }));

  readonly recentEntriesQuery = injectQuery(() => {
    const party = this.partyIdFilter();
    const date = this.dateFilter();
    return {
      queryKey: queryKeys.entries.list({
        party: party || undefined,
        from: date ?? undefined,
        to: date ?? undefined,
      }),
      queryFn: () =>
        lastValueFrom(this.entriesApi.list({ party, from: date!, to: date! })),
      staleTime: STALE.entries,
      enabled: !!party && !!date,
    };
  });

  readonly parties = computed(() => this.partiesQuery.data() ?? []);
  readonly recentEntries = computed(() => this.recentEntriesQuery.data() ?? []);
  readonly loadingRecent = computed(
    () =>
      !!this.partyIdFilter() &&
      !!this.dateFilter() &&
      this.recentEntriesQuery.isPending() &&
      !this.recentEntriesQuery.data(),
  );

  readonly selectedParty = computed(() => {
    const id = this.partyIdFilter();
    return this.parties().find((p) => p._id === id) ?? null;
  });

  readonly selectedPartyBalance = computed(() => {
    const party = this.selectedParty();
    return party ? formatAccountBalance(party.currentBalance ?? party.openingBalance) : null;
  });

  readonly createEntryMutation = injectMutation(() => ({
    mutationFn: (payload: {
      party: string;
      date: string;
      type: AccountEntryType;
      amount: number;
      particular?: string;
    }) => lastValueFrom(this.entriesApi.create(payload)),
    onSuccess: async (_data, payload) => {
      await invalidateAfter.accountEntry(this.queryClient);
      this.messages.add({ severity: 'success', summary: 'Entry saved' });
      this.form.patchValue({ amount: null, particular: '' });
      this.partyIdFilter.set(payload.party);
      this.dateFilter.set(payload.date);
    },
    onError: (err) => {
      this.messages.add({
        severity: 'error',
        summary: 'Could not save entry',
        detail: apiErrorMessage(err),
      });
    },
  }));

  readonly createPartyMutation = injectMutation(() => ({
    mutationFn: (payload: {
      name: string;
      phone?: string;
      notes?: string;
      openingBalance: number;
    }) => lastValueFrom(this.partiesApi.create(payload)),
    onSuccess: async (party: Party) => {
      await invalidateAfter.party(this.queryClient);
      this.partyDialogVisible.set(false);
      this.messages.add({ severity: 'success', summary: 'Party created' });
      this.form.controls.partyId.setValue(party._id);
      this.partyIdFilter.set(party._id);
    },
    onError: (err) => {
      this.messages.add({
        severity: 'error',
        summary: 'Could not create party',
        detail: apiErrorMessage(err),
      });
    },
  }));

  readonly saving = computed(() => this.createEntryMutation.isPending());
  readonly savingParty = computed(() => this.createPartyMutation.isPending());

  constructor() {
    this.form.controls.date.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((date) => {
        this.dateFilter.set(date ? toIsoDate(date) : null);
      });
    this.form.controls.partyId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((partyId) => {
        this.partyIdFilter.set(partyId || '');
      });
  }

  setType(type: AccountEntryType): void {
    this.form.controls.type.setValue(type);
  }

  onPartyChange(): void {
    this.partyIdFilter.set(this.form.controls.partyId.value || '');
  }

  openPartyDialog(): void {
    this.partyForm.reset({ name: '', phone: '', notes: '', openingBalance: 0 });
    this.partyDialogVisible.set(true);
  }

  saveParty(): void {
    if (this.partyForm.invalid) {
      this.partyForm.markAllAsTouched();
      toastMissingRequired(this.messages);
      return;
    }
    const v = this.partyForm.getRawValue();
    this.createPartyMutation.mutate({
      name: toUpperAlpha(v.name.trim()),
      phone: v.phone.trim() || undefined,
      notes: v.notes.trim() ? toUpperAlpha(v.notes.trim()) : undefined,
      openingBalance: Number(v.openingBalance) || 0,
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      toastMissingRequired(this.messages);
      return;
    }
    const v = this.form.getRawValue();
    this.createEntryMutation.mutate({
      party: v.partyId,
      date: toIsoDate(v.date),
      type: v.type,
      amount: Number(v.amount),
      particular: v.particular.trim() ? toUpperAlpha(v.particular.trim()) : undefined,
    });
  }

  entryLabel(entry: AccountEntry): string {
    return entryTypeLabel(entry.type, entry.source ?? 'manual');
  }

  formatAmount(value: number): string {
    return formatCurrency(value);
  }

  partyName(entry: AccountEntry): string {
    return typeof entry.party === 'object' && entry.party ? entry.party.name : '—';
  }
}
