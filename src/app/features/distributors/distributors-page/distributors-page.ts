import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { Textarea } from 'primeng/textarea';
import { lastValueFrom } from 'rxjs';
import { COMPANIES, Distributor, Party } from '../../../core/models/gms.models';
import { DistributorService } from '../../../core/services/api/distributor.service';
import { PartyService } from '../../../core/services/api/party.service';
import {
  injectMutation,
  injectQuery,
  invalidateAfter,
  injectQueryClient,
  queryKeys,
  STALE,
} from '../../../core/query';
import { apiErrorMessage } from '../../../core/utils/api-error';
import { distributorIdFromParty } from '../../../core/utils/distributor';
import { toastMissingRequired } from '../../../core/utils/form-validation';
import { toUpperAlpha, UppercaseInputDirective } from '../../../shared/uppercase-input.directive';
import { QueryState } from '../../../shared/query-state/query-state';

@Component({
  selector: 'app-distributors-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    Button,
    Dialog,
    InputText,
    Select,
    TableModule,
    Textarea,
    UppercaseInputDirective,
    QueryState,
  ],
  templateUrl: './distributors-page.html',
})
export class DistributorsPage {
  private readonly api = inject(DistributorService);
  private readonly partiesApi = inject(PartyService);
  private readonly fb = inject(FormBuilder);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  private readonly queryClient = injectQueryClient();

  readonly distributorsQuery = injectQuery(() => ({
    queryKey: queryKeys.distributors.list(),
    queryFn: () => lastValueFrom(this.api.list()),
    staleTime: STALE.distributors,
  }));

  readonly partiesQuery = injectQuery(() => ({
    queryKey: queryKeys.parties.list(),
    queryFn: () => lastValueFrom(this.partiesApi.list()),
    staleTime: STALE.parties,
  }));

  readonly rows = computed(() => this.distributorsQuery.data() ?? []);
  readonly loading = computed(
    () => this.distributorsQuery.isPending() && !this.distributorsQuery.data(),
  );
  readonly loadError = computed(() => this.distributorsQuery.isError());
  readonly partyByDistributor = computed(() =>
    this.buildPartyMap(this.partiesQuery.data() ?? []),
  );

  readonly companies = COMPANIES;
  readonly dialogVisible = signal(false);
  readonly editingId = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    company: ['' as (typeof COMPANIES)[number] | '', Validators.required],
    name: ['', Validators.required],
    phone: [''],
    address: ['', Validators.required],
  });

  readonly saveMutation = injectMutation(() => ({
    mutationFn: (input: {
      id: string | null;
      payload: {
        company: (typeof COMPANIES)[number];
        name: string;
        phone?: string;
        address: string;
      };
    }) =>
      lastValueFrom(
        input.id ? this.api.update(input.id, input.payload) : this.api.create(input.payload),
      ),
    onSuccess: async (_data, input) => {
      await invalidateAfter.distributor(this.queryClient);
      this.dialogVisible.set(false);
      this.messages.add({
        severity: 'success',
        summary: input.id ? 'Distributor updated' : 'Distributor created',
      });
    },
    onError: (err) => {
      this.messages.add({
        severity: 'error',
        summary: 'Could not save distributor',
        detail: apiErrorMessage(err),
      });
    },
  }));

  readonly deleteMutation = injectMutation(() => ({
    mutationFn: (id: string) => lastValueFrom(this.api.remove(id)),
    onSuccess: async () => {
      await invalidateAfter.distributor(this.queryClient);
      this.messages.add({ severity: 'success', summary: 'Distributor deleted' });
    },
    onError: (err) => {
      this.messages.add({
        severity: 'error',
        summary: 'Could not delete distributor',
        detail: apiErrorMessage(err),
      });
    },
  }));

  readonly saving = computed(() => this.saveMutation.isPending());

  partyIdFor(distributorId: string): string | null {
    return this.partyByDistributor()[distributorId] ?? null;
  }

  openCreate(): void {
    this.editingId.set(null);
    this.form.reset({ company: '', name: '', phone: '', address: '' });
    this.dialogVisible.set(true);
  }

  openEdit(row: Distributor): void {
    this.editingId.set(row._id);
    this.form.reset({
      company: row.company,
      name: row.name,
      phone: row.phone || '',
      address: row.address,
    });
    this.dialogVisible.set(true);
  }

  confirmDelete(row: Distributor): void {
    this.confirm.confirm({
      header: 'Delete distributor?',
      message: `“${row.name}” will be hidden from lists. Historical DACs stay intact.`,
      icon: 'pi pi-trash',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptIcon: 'pi pi-trash',
      accept: () => this.deleteMutation.mutate(row._id),
    });
  }

  retryLoad(): void {
    this.distributorsQuery.refetch();
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
        company: v.company as (typeof COMPANIES)[number],
        name: toUpperAlpha(v.name.trim()),
        phone: v.phone.trim() || undefined,
        address: toUpperAlpha(v.address.trim()),
      },
    });
  }

  private buildPartyMap(parties: Party[]): Record<string, string> {
    const map: Record<string, string> = {};
    for (const party of parties) {
      const distributorId = distributorIdFromParty(party.distributor);
      if (distributorId) map[distributorId] = party._id;
    }
    return map;
  }
}
