import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { Textarea } from 'primeng/textarea';
import { debounceTime } from 'rxjs/operators';
import { lastValueFrom } from 'rxjs';
import { Consumer, Distributor } from '../../../core/models/gms.models';
import { ConsumerService } from '../../../core/services/api/consumer.service';
import { DistributorService } from '../../../core/services/api/distributor.service';
import {
  ConsumerListFilters,
  injectMutation,
  injectQuery,
  injectQueryClient,
  invalidateAfter,
  queryKeys,
  STALE,
} from '../../../core/query';
import { apiErrorMessage } from '../../../core/utils/api-error';
import { consumerDistributorLabel } from '../../../core/utils/distributor';
import { downloadCsv, downloadPdf } from '../../../core/utils/export-report';
import { toastMissingRequired } from '../../../core/utils/form-validation';
import { HpPayConsumerFields } from '../../../core/utils/hp-pay-profile';
import { HpPayScreenshotUpload } from '../../../shared/hp-pay-screenshot-upload/hp-pay-screenshot-upload';
import { QueryState } from '../../../shared/query-state/query-state';
import { toUpperAlpha, UppercaseInputDirective } from '../../../shared/uppercase-input.directive';

const PAGE_SIZE = 25;

@Component({
  selector: 'app-consumers-page',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    Button,
    Dialog,
    InputText,
    Select,
    TableModule,
    Textarea,
    HpPayScreenshotUpload,
    UppercaseInputDirective,
    QueryState,
  ],
  templateUrl: './consumers-page.html',
})
export class ConsumersPage {
  private readonly api = inject(ConsumerService);
  private readonly distributorsApi = inject(DistributorService);
  private readonly fb = inject(FormBuilder);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  private readonly queryClient = injectQueryClient();
  private readonly destroyRef = inject(DestroyRef);

  readonly filterDistributorId = signal<string | null>(null);
  readonly filterConsumerNumber = signal('');
  readonly filterPhone = signal('');
  readonly filterName = signal('');
  readonly page = signal(1);
  readonly pageSize = PAGE_SIZE;

  private readonly appliedFilters = signal<ConsumerListFilters>({
    page: 1,
    limit: PAGE_SIZE,
  });

  readonly distributorsQuery = injectQuery(() => ({
    queryKey: queryKeys.distributors.list(),
    queryFn: () => lastValueFrom(this.distributorsApi.list()),
    staleTime: STALE.distributors,
  }));

  readonly consumersQuery = injectQuery(() => {
    const filters = this.appliedFilters();
    return {
      queryKey: queryKeys.consumers.list(filters),
      queryFn: () => lastValueFrom(this.api.list(filters)),
      staleTime: STALE.consumers,
    };
  });

  readonly distributors = computed(() => this.distributorsQuery.data() ?? ([] as Distributor[]));
  readonly rows = computed(() => this.consumersQuery.data()?.items ?? []);
  readonly totalRecords = computed(() => this.consumersQuery.data()?.total ?? 0);
  readonly loading = computed(
    () => this.consumersQuery.isPending() && !this.consumersQuery.data(),
  );
  readonly loadError = computed(() => this.consumersQuery.isError());
  readonly hasActiveFilters = computed(() => {
    const f = this.appliedFilters();
    return !!(f.distributor || f.consumerNumber || f.phone || f.name);
  });

  readonly dialogVisible = signal(false);
  readonly editingId = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    distributor: ['', Validators.required],
    consumerNumber: ['', Validators.required],
    name: ['', Validators.required],
    fatherName: [''],
    phone: [''],
    address: [''],
  });

  readonly saveMutation = injectMutation(() => ({
    mutationFn: (input: {
      id: string | null;
      payload: {
        distributor: string;
        consumerNumber: string;
        name: string;
        fatherName?: string;
        phone?: string;
        address?: string;
      };
    }) =>
      lastValueFrom(
        input.id ? this.api.update(input.id, input.payload) : this.api.create(input.payload),
      ),
    onSuccess: async (_data, input) => {
      await invalidateAfter.consumer(this.queryClient);
      this.dialogVisible.set(false);
      this.messages.add({
        severity: 'success',
        summary: input.id ? 'Consumer updated' : 'Consumer created',
      });
    },
    onError: (err) => {
      this.messages.add({
        severity: 'error',
        summary: 'Could not save consumer',
        detail: apiErrorMessage(err),
      });
    },
  }));

  readonly deleteMutation = injectMutation(() => ({
    mutationFn: (id: string) => lastValueFrom(this.api.remove(id)),
    onSuccess: async () => {
      await invalidateAfter.consumer(this.queryClient);
      this.messages.add({ severity: 'success', summary: 'Consumer deleted' });
    },
    onError: (err) => {
      this.messages.add({
        severity: 'error',
        summary: 'Could not delete consumer',
        detail: apiErrorMessage(err),
      });
    },
  }));

  readonly saving = computed(() => this.saveMutation.isPending());

  constructor() {
    toObservable(
      computed(() => ({
        distributor: this.filterDistributorId() || undefined,
        consumerNumber: this.filterConsumerNumber().trim() || undefined,
        phone: this.filterPhone().trim() || undefined,
        name: this.filterName().trim() || undefined,
      })),
    )
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe((filters) => {
        this.page.set(1);
        this.appliedFilters.set({
          ...filters,
          page: 1,
          limit: this.pageSize,
        });
      });
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    const rows = event.rows ?? this.pageSize;
    const first = event.first ?? 0;
    const nextPage = Math.floor(first / rows) + 1;
    this.page.set(nextPage);
    this.appliedFilters.update((current) => ({
      ...current,
      page: nextPage,
      limit: rows,
    }));
  }

  retryLoad(): void {
    this.consumersQuery.refetch();
  }

  distributorLabel(row: Consumer): string {
    return consumerDistributorLabel(row);
  }

  distributorId(row: Consumer): string {
    return typeof row.distributor === 'object' && row.distributor
      ? row.distributor._id
      : String(row.distributor);
  }

  clearFilters(): void {
    this.filterDistributorId.set(null);
    this.filterConsumerNumber.set('');
    this.filterPhone.set('');
    this.filterName.set('');
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

  applyHpPayFields(fields: HpPayConsumerFields): void {
    this.form.patchValue({
      ...(fields.consumerNumber ? { consumerNumber: toUpperAlpha(fields.consumerNumber) } : {}),
      ...(fields.name ? { name: toUpperAlpha(fields.name) } : {}),
      ...(fields.phone ? { phone: fields.phone } : {}),
      ...(fields.address ? { address: toUpperAlpha(fields.address) } : {}),
    });
  }

  openEdit(row: Consumer): void {
    this.editingId.set(row._id);
    this.form.reset({
      distributor: this.distributorId(row),
      consumerNumber: toUpperAlpha(row.consumerNumber),
      name: toUpperAlpha(row.name),
      fatherName: row.fatherName ? toUpperAlpha(row.fatherName) : '',
      phone: row.phone || '',
      address: row.address ? toUpperAlpha(row.address) : '',
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
      accept: () => this.deleteMutation.mutate(row._id),
    });
  }

  async exportCsv(): Promise<void> {
    const table = await this.buildExportTable();
    if (!table) return;
    downloadCsv(table);
  }

  async exportPdf(): Promise<void> {
    const table = await this.buildExportTable();
    if (!table) return;
    downloadPdf(table);
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
        distributor: v.distributor,
        consumerNumber: toUpperAlpha(v.consumerNumber.trim()),
        name: toUpperAlpha(v.name.trim()),
        fatherName: v.fatherName.trim() ? toUpperAlpha(v.fatherName.trim()) : undefined,
        phone: v.phone.trim() || undefined,
        address: v.address.trim() ? toUpperAlpha(v.address.trim()) : undefined,
      },
    });
  }

  private async buildExportTable() {
    const filters = this.appliedFilters();
    try {
      const data = await lastValueFrom(
        this.api.list({
          distributor: filters.distributor,
          consumerNumber: filters.consumerNumber,
          phone: filters.phone,
          name: filters.name,
          page: 1,
          limit: 5000,
        }),
      );
      const rows = data.items;
      if (!rows.length) {
        this.messages.add({
          severity: 'warn',
          summary: 'Nothing to export',
          detail: 'No consumers match the current filters.',
        });
        return null;
      }

      return {
        title: 'Consumers',
        subtitle: `${rows.length} consumer${rows.length === 1 ? '' : 's'}`,
        headers: ['Consumer no.', 'Name', 'Father name', 'Distributor', 'Phone', 'Address'],
        rows: rows.map((row) => [
          row.consumerNumber,
          row.name,
          row.fatherName || '',
          this.distributorLabel(row),
          row.phone || '',
          row.address || '',
        ]),
        filename: 'consumers',
      };
    } catch (err) {
      this.messages.add({
        severity: 'error',
        summary: 'Export failed',
        detail: apiErrorMessage(err),
      });
      return null;
    }
  }
}
