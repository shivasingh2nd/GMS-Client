import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { Textarea } from 'primeng/textarea';
import { lastValueFrom } from 'rxjs';
import { Party } from '../../../core/models/gms.models';
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
import { formatAccountBalance } from '../../../core/utils/account-balance';
import { toastMissingRequired } from '../../../core/utils/form-validation';
import { toUpperAlpha, UppercaseInputDirective } from '../../../shared/uppercase-input.directive';
import { QueryState } from '../../../shared/query-state/query-state';

@Component({
  selector: 'app-parties-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    Button,
    Dialog,
    InputNumber,
    InputText,
    TableModule,
    Textarea,
    UppercaseInputDirective,
    QueryState,
  ],
  templateUrl: './parties-page.html',
})
export class PartiesPage {
  private readonly api = inject(PartyService);
  private readonly fb = inject(FormBuilder);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  private readonly queryClient = injectQueryClient();

  readonly partiesQuery = injectQuery(() => ({
    queryKey: queryKeys.parties.list(),
    queryFn: () => lastValueFrom(this.api.list()),
    staleTime: STALE.parties,
  }));

  readonly rows = computed(() => this.partiesQuery.data() ?? []);
  readonly loading = computed(() => this.partiesQuery.isPending() && !this.partiesQuery.data());
  readonly loadError = computed(() => this.partiesQuery.isError());

  readonly dialogVisible = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly editingDistributorParty = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    phone: [''],
    notes: [''],
    openingBalance: [0],
  });

  readonly saveMutation = injectMutation(() => ({
    mutationFn: (input: {
      id: string | null;
      isDistributorParty: boolean;
      payload: {
        name?: string;
        phone?: string;
        notes?: string;
        openingBalance?: number;
      };
    }) => {
      if (input.id) {
        return lastValueFrom(this.api.update(input.id, input.payload));
      }
      return lastValueFrom(
        this.api.create({
          name: input.payload.name!,
          phone: input.payload.phone,
          notes: input.payload.notes,
          openingBalance: input.payload.openingBalance,
        }),
      );
    },
    onSuccess: async (_data, input) => {
      await invalidateAfter.party(this.queryClient);
      this.dialogVisible.set(false);
      this.messages.add({
        severity: 'success',
        summary: input.id ? 'Party updated' : 'Party created',
      });
    },
    onError: (err) => {
      this.messages.add({
        severity: 'error',
        summary: 'Could not save party',
        detail: apiErrorMessage(err),
      });
    },
  }));

  readonly deleteMutation = injectMutation(() => ({
    mutationFn: (id: string) => lastValueFrom(this.api.remove(id)),
    onSuccess: async () => {
      await invalidateAfter.party(this.queryClient);
      this.messages.add({ severity: 'success', summary: 'Party deleted' });
    },
    onError: (err) => {
      this.messages.add({
        severity: 'error',
        summary: 'Could not delete party',
        detail: apiErrorMessage(err),
      });
    },
  }));

  readonly saving = computed(() => this.saveMutation.isPending());

  balanceLabel(row: Party): string {
    return formatAccountBalance(row.currentBalance ?? row.openingBalance).label;
  }

  balanceAmount(row: Party): string {
    return formatAccountBalance(row.currentBalance ?? row.openingBalance).amount;
  }

  balanceTone(row: Party): string {
    return formatAccountBalance(row.currentBalance ?? row.openingBalance).tone;
  }

  isDistributorParty(row: Party): boolean {
    return !!row.distributor;
  }

  openCreate(): void {
    this.editingId.set(null);
    this.editingDistributorParty.set(false);
    this.form.reset({ name: '', phone: '', notes: '', openingBalance: 0 });
    this.form.controls.name.enable();
    this.form.controls.phone.enable();
    this.dialogVisible.set(true);
  }

  openEdit(row: Party): void {
    const isDistributorParty = this.isDistributorParty(row);
    this.editingId.set(row._id);
    this.editingDistributorParty.set(isDistributorParty);
    this.form.reset({
      name: row.name,
      phone: row.phone || '',
      notes: row.notes || '',
      openingBalance: row.openingBalance,
    });
    if (isDistributorParty) {
      this.form.controls.name.disable();
      this.form.controls.phone.disable();
    } else {
      this.form.controls.name.enable();
      this.form.controls.phone.enable();
    }
    this.dialogVisible.set(true);
  }

  confirmDelete(row: Party): void {
    this.confirm.confirm({
      header: 'Delete party?',
      message: `“${row.name}” will be hidden from lists. Existing entries stay in the ledger.`,
      icon: 'pi pi-trash',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptIcon: 'pi pi-trash',
      accept: () => this.deleteMutation.mutate(row._id),
    });
  }

  retryLoad(): void {
    this.partiesQuery.refetch();
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      toastMissingRequired(this.messages);
      return;
    }
    const v = this.form.getRawValue();
    const id = this.editingId();
    const isDistributorParty = this.editingDistributorParty();
    this.saveMutation.mutate({
      id,
      isDistributorParty,
      payload: id
        ? {
            ...(isDistributorParty
              ? {}
              : {
                  name: toUpperAlpha(v.name.trim()),
                  phone: v.phone.trim() || undefined,
                }),
            notes: v.notes.trim() ? toUpperAlpha(v.notes.trim()) : undefined,
            openingBalance: Number(v.openingBalance) || 0,
          }
        : {
            name: toUpperAlpha(v.name.trim()),
            phone: v.phone.trim() || undefined,
            notes: v.notes.trim() ? toUpperAlpha(v.notes.trim()) : undefined,
            openingBalance: Number(v.openingBalance) || 0,
          },
    });
  }
}
