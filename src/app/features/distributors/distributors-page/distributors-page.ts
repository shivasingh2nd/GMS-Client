import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { Textarea } from 'primeng/textarea';
import { COMPANIES, Distributor, Party } from '../../../core/models/gms.models';
import { DistributorService } from '../../../core/services/api/distributor.service';
import { PartyService } from '../../../core/services/api/party.service';
import { apiErrorMessage } from '../../../core/utils/api-error';
import { distributorIdFromParty } from '../../../core/utils/distributor';
import { toastMissingRequired } from '../../../core/utils/form-validation';

@Component({
  selector: 'app-distributors-page',
  imports: [ReactiveFormsModule, RouterLink, Button, Dialog, InputText, Select, TableModule, Textarea],
  templateUrl: './distributors-page.html',
})
export class DistributorsPage implements OnInit {
  private readonly api = inject(DistributorService);
  private readonly partiesApi = inject(PartyService);
  private readonly fb = inject(FormBuilder);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly rows = signal<Distributor[]>([]);
  readonly partyByDistributor = signal<Record<string, string>>({});
  readonly companies = COMPANIES;
  readonly loading = signal(false);
  readonly dialogVisible = signal(false);
  readonly saving = signal(false);
  readonly editingId = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    company: ['' as (typeof COMPANIES)[number] | '', Validators.required],
    name: ['', Validators.required],
    phone: [''],
    address: ['', Validators.required],
  });

  ngOnInit(): void {
    this.partiesApi.list().subscribe({
      next: (parties) => this.partyByDistributor.set(this.buildPartyMap(parties)),
    });
    this.reload();
  }

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
      accept: () => this.remove(row._id),
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      toastMissingRequired(this.messages);
      return;
    }
    const v = this.form.getRawValue();
    const id = this.editingId();
    const payload = {
      company: v.company as (typeof COMPANIES)[number],
      name: v.name.trim(),
      phone: v.phone.trim() || undefined,
      address: v.address.trim(),
    };
    this.saving.set(true);

    const request = id ? this.api.update(id, payload) : this.api.create(payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogVisible.set(false);
        this.messages.add({
          severity: 'success',
          summary: id ? 'Distributor updated' : 'Distributor created',
        });
        this.reload();
      },
      error: (err) => {
        this.saving.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'Could not save distributor',
          detail: apiErrorMessage(err),
        });
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

  private remove(id: string): void {
    this.api.remove(id).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: 'Distributor deleted' });
        this.reload();
      },
      error: (err) => {
        this.messages.add({
          severity: 'error',
          summary: 'Could not delete distributor',
          detail: err?.error?.message || 'Request failed',
        });
      },
    });
  }

  private reload(): void {
    this.loading.set(true);
    this.api.list().subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'Failed to load distributors',
          detail: err?.error?.message || 'Request failed',
        });
      },
    });
  }
}
