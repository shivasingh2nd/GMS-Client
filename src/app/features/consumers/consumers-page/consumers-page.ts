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
import { Consumer, Distributor } from '../../../core/models/gms.models';
import { ConsumerService } from '../../../core/services/api/consumer.service';
import { DistributorService } from '../../../core/services/api/distributor.service';
import { apiErrorMessage } from '../../../core/utils/api-error';
import { consumerDistributorLabel } from '../../../core/utils/distributor';

@Component({
  selector: 'app-consumers-page',
  imports: [ReactiveFormsModule, RouterLink, Button, Dialog, InputText, Select, TableModule, Textarea],
  templateUrl: './consumers-page.html',
})
export class ConsumersPage implements OnInit {
  private readonly api = inject(ConsumerService);
  private readonly distributorsApi = inject(DistributorService);
  private readonly fb = inject(FormBuilder);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly rows = signal<Consumer[]>([]);
  readonly distributors = signal<Distributor[]>([]);
  readonly loading = signal(false);
  readonly dialogVisible = signal(false);
  readonly saving = signal(false);
  readonly editingId = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    distributor: ['', Validators.required],
    consumerNumber: ['', Validators.required],
    name: ['', Validators.required],
    fatherName: [''],
    phone: [''],
    address: [''],
  });

  ngOnInit(): void {
    this.distributorsApi.list().subscribe({
      next: (rows) => this.distributors.set(rows),
    });
    this.reload();
  }

  distributorLabel(row: Consumer): string {
    return consumerDistributorLabel(row);
  }

  distributorId(row: Consumer): string {
    return typeof row.distributor === 'object' && row.distributor
      ? row.distributor._id
      : String(row.distributor);
  }

  openCreate(): void {
    this.editingId.set(null);
    this.form.reset({
      distributor: '',
      consumerNumber: '',
      name: '',
      fatherName: '',
      phone: '',
      address: '',
    });
    this.dialogVisible.set(true);
  }

  openEdit(row: Consumer): void {
    this.editingId.set(row._id);
    this.form.reset({
      distributor: this.distributorId(row),
      consumerNumber: row.consumerNumber,
      name: row.name,
      fatherName: row.fatherName || '',
      phone: row.phone || '',
      address: row.address || '',
    });
    this.dialogVisible.set(true);
  }

  confirmDelete(row: Consumer): void {
    this.confirm.confirm({
      header: 'Delete consumer?',
      message: `“${row.consumerNumber} · ${row.name}” will be hidden from lists. Historical DACs stay intact.`,
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
    const payload = {
      distributor: v.distributor,
      consumerNumber: v.consumerNumber.trim(),
      name: v.name.trim(),
      fatherName: v.fatherName.trim() || undefined,
      phone: v.phone.trim() || undefined,
      address: v.address.trim() || undefined,
    };
    this.saving.set(true);

    const request = id ? this.api.update(id, payload) : this.api.create(payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogVisible.set(false);
        this.messages.add({
          severity: 'success',
          summary: id ? 'Consumer updated' : 'Consumer created',
        });
        this.reload();
      },
      error: (err) => {
        this.saving.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'Could not save consumer',
          detail: apiErrorMessage(err),
        });
      },
    });
  }

  private remove(id: string): void {
    this.api.remove(id).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: 'Consumer deleted' });
        this.reload();
      },
      error: (err) => {
        this.messages.add({
          severity: 'error',
          summary: 'Could not delete consumer',
          detail: apiErrorMessage(err),
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
          summary: 'Failed to load consumers',
          detail: apiErrorMessage(err),
        });
      },
    });
  }
}
