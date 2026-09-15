import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Password } from 'primeng/password';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { lastValueFrom } from 'rxjs';
import { User } from '../../../core/models/gms.models';
import { UserService } from '../../../core/services/api/user.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  injectMutation,
  injectQuery,
  injectQueryClient,
  invalidateAfter,
  queryKeys,
  STALE,
} from '../../../core/query';
import { apiErrorMessage } from '../../../core/utils/api-error';
import { toastMissingRequired } from '../../../core/utils/form-validation';
import { toUpperAlpha, UppercaseInputDirective } from '../../../shared/uppercase-input.directive';
import { QueryState } from '../../../shared/query-state/query-state';

@Component({
  selector: 'app-users-page',
  imports: [
    ReactiveFormsModule,
    Button,
    Dialog,
    InputText,
    Password,
    TableModule,
    Tag,
    UppercaseInputDirective,
    QueryState,
  ],
  templateUrl: './users-page.html',
})
export class UsersPage {
  private readonly api = inject(UserService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  private readonly queryClient = injectQueryClient();

  readonly usersQuery = injectQuery(() => ({
    queryKey: queryKeys.users.list(),
    queryFn: () => lastValueFrom(this.api.list()),
    staleTime: STALE.users,
  }));

  readonly rows = computed(() => this.usersQuery.data() ?? []);
  readonly loading = computed(() => this.usersQuery.isPending() && !this.usersQuery.data());
  readonly loadError = computed(() => this.usersQuery.isError());
  readonly dialogVisible = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  readonly createMutation = injectMutation(() => ({
    mutationFn: (payload: { name: string; email: string; password: string }) =>
      lastValueFrom(this.api.create(payload)),
    onSuccess: async () => {
      await invalidateAfter.user(this.queryClient);
      this.dialogVisible.set(false);
      this.messages.add({ severity: 'success', summary: 'User created' });
    },
    onError: (err) => {
      this.messages.add({
        severity: 'error',
        summary: 'Could not create user',
        detail: apiErrorMessage(err),
      });
    },
  }));

  readonly setActiveMutation = injectMutation(() => ({
    mutationFn: (input: { id: string; isActive: boolean }) =>
      lastValueFrom(this.api.setActive(input.id, input.isActive)),
    onSuccess: async (_data, input) => {
      await invalidateAfter.user(this.queryClient);
      this.messages.add({
        severity: 'success',
        summary: input.isActive ? 'User activated' : 'User deactivated',
      });
    },
    onError: (err) => {
      this.messages.add({
        severity: 'error',
        summary: 'Could not update user',
        detail: apiErrorMessage(err),
      });
    },
  }));

  readonly saving = computed(() => this.createMutation.isPending());

  openCreate(): void {
    this.form.reset({ name: '', email: '', password: '' });
    this.dialogVisible.set(true);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      toastMissingRequired(this.messages);
      return;
    }
    const v = this.form.getRawValue();
    this.createMutation.mutate({
      name: toUpperAlpha(v.name.trim()),
      email: v.email.trim(),
      password: v.password,
    });
  }

  confirmToggle(row: User): void {
    if (row.role === 'admin') return;
    const nextActive = !(row.isActive !== false);
    this.confirm.confirm({
      header: nextActive ? 'Activate user?' : 'Deactivate user?',
      message: nextActive
        ? `Allow “${row.name}” to sign in again?`
        : `“${row.name}” will not be able to sign in.`,
      icon: 'pi pi-user',
      acceptLabel: nextActive ? 'Activate' : 'Deactivate',
      rejectLabel: 'Cancel',
      accept: () => this.setActiveMutation.mutate({ id: row.id, isActive: nextActive }),
    });
  }

  isSelf(row: User): boolean {
    return this.auth.user()?.id === row.id;
  }

  retryLoad(): void {
    this.usersQuery.refetch();
  }
}
