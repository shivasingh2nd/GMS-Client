import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
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
import { AccountEntry, AccountEntryType, Party } from '../../../core/models/gms.models';
import { AccountEntryService } from '../../../core/services/api/account-entry.service';
import { PartyService } from '../../../core/services/api/party.service';
import { apiErrorMessage } from '../../../core/utils/api-error';
import {
  entryTypeLabel,
  formatAccountBalance,
  formatCurrency,
} from '../../../core/utils/account-balance';
import { toIsoDate } from '../../../core/utils/date';

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
  ],
  templateUrl: './account-entry.html',
})
export class AccountEntryPage implements OnInit {
  private readonly entriesApi = inject(AccountEntryService);
  private readonly partiesApi = inject(PartyService);
  private readonly fb = inject(FormBuilder);
  private readonly messages = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly parties = signal<Party[]>([]);
  readonly recentEntries = signal<AccountEntry[]>([]);
  readonly loadingRecent = signal(false);
  readonly saving = signal(false);
  readonly partyDialogVisible = signal(false);
  readonly savingParty = signal(false);

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

  readonly selectedParty = computed(() => {
    const id = this.form.controls.partyId.value;
    return this.parties().find((p) => p._id === id) ?? null;
  });

  readonly selectedPartyBalance = computed(() => {
    const party = this.selectedParty();
    return party ? formatAccountBalance(party.currentBalance ?? party.openingBalance) : null;
  });

  ngOnInit(): void {
    this.reloadParties();
    this.form.controls.date.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadRecent());
    this.form.controls.partyId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadRecent());
  }

  setType(type: AccountEntryType): void {
    this.form.controls.type.setValue(type);
  }

  onPartyChange(): void {
    this.loadRecent();
  }

  openPartyDialog(): void {
    this.partyForm.reset({ name: '', phone: '', notes: '', openingBalance: 0 });
    this.partyDialogVisible.set(true);
  }

  saveParty(): void {
    if (this.partyForm.invalid) {
      this.partyForm.markAllAsTouched();
      return;
    }
    const v = this.partyForm.getRawValue();
    this.savingParty.set(true);
    this.partiesApi
      .create({
        name: v.name.trim(),
        phone: v.phone.trim() || undefined,
        notes: v.notes.trim() || undefined,
        openingBalance: Number(v.openingBalance) || 0,
      })
      .subscribe({
        next: (party) => {
          this.savingParty.set(false);
          this.partyDialogVisible.set(false);
          this.messages.add({ severity: 'success', summary: 'Party created' });
          this.reloadParties(party._id);
        },
        error: (err) => {
          this.savingParty.set(false);
          this.messages.add({
            severity: 'error',
            summary: 'Could not create party',
            detail: apiErrorMessage(err),
          });
        },
      });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.entriesApi
      .create({
        party: v.partyId,
        date: toIsoDate(v.date),
        type: v.type,
        amount: Number(v.amount),
        particular: v.particular.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.messages.add({ severity: 'success', summary: 'Entry saved' });
          this.form.patchValue({ amount: null, particular: '' });
          this.reloadParties(v.partyId);
          this.loadRecent();
        },
        error: (err) => {
          this.saving.set(false);
          this.messages.add({
            severity: 'error',
            summary: 'Could not save entry',
            detail: apiErrorMessage(err),
          });
        },
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

  private reloadParties(selectId?: string): void {
    this.partiesApi.list().subscribe({
      next: (rows) => {
        this.parties.set(rows);
        if (selectId) {
          this.form.controls.partyId.setValue(selectId);
        }
        this.loadRecent();
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

  loadRecent(): void {
    const partyId = this.form.controls.partyId.value;
    const date = this.form.controls.date.value;
    if (!partyId || !date) {
      this.recentEntries.set([]);
      return;
    }
    this.loadingRecent.set(true);
    const iso = toIsoDate(date);
    this.entriesApi.list({ party: partyId, from: iso, to: iso }).subscribe({
      next: (rows) => {
        this.recentEntries.set(rows);
        this.loadingRecent.set(false);
      },
      error: () => this.loadingRecent.set(false),
    });
  }

}
