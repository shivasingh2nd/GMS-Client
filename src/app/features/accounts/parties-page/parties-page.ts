import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { Textarea } from 'primeng/textarea';
import { Party } from '../../../core/models/gms.models';
import { PartyService } from '../../../core/services/api/party.service';
import { formatAccountBalance } from '../../../core/utils/account-balance';

@Component({
  selector: 'app-parties-page',
  imports: [ReactiveFormsModule, RouterLink, Button, Dialog, InputNumber, InputText, TableModule, Textarea],
  templateUrl: './parties-page.html',
})
export class PartiesPage implements OnInit {
  private readonly api = inject(PartyService);
  private readonly fb = inject(FormBuilder);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly rows = signal<Party[]>([]);
  readonly loading = signal(false);
  readonly dialogVisible = signal(false);
  readonly saving = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly editingDistributorParty = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    phone: [''],
    notes: [''],
    openingBalance: [0],
  });

  ngOnInit(): void {
    this.reload();
  }

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
      accept: () => this.remove(row._id),
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const id = this.editingId();
    const isDistributorParty = this.editingDistributorParty();
    this.saving.set(true);
    const request = id
      ? this.api.update(id, {
          ...(isDistributorParty
            ? {}
            : { name: v.name.trim(), phone: v.phone.trim() || undefined }),
          notes: v.notes.trim() || undefined,
          openingBalance: Number(v.openingBalance) || 0,
        })
      : this.api.create({
          name: v.name.trim(),
          phone: v.phone.trim() || undefined,
          notes: v.notes.trim() || undefined,
          openingBalance: Number(v.openingBalance) || 0,
        });
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogVisible.set(false);
        this.messages.add({
          severity: 'success',
          summary: id ? 'Party updated' : 'Party created',
        });
        this.reload();
      },
      error: (err) => {
        this.saving.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'Could not save party',
          detail: err?.error?.message || 'Request failed',
        });
      },
    });
  }

  private remove(id: string): void {
    this.api.remove(id).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: 'Party deleted' });
        this.reload();
      },
      error: (err) => {
        this.messages.add({
          severity: 'error',
          summary: 'Could not delete party',
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
          summary: 'Failed to load parties',
          detail: err?.error?.message || 'Request failed',
        });
      },
    });
  }
}
