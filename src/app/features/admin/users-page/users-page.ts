import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Password } from 'primeng/password';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { User } from '../../../core/models/gms.models';
import { UserService } from '../../../core/services/api/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { apiErrorMessage } from '../../../core/utils/api-error';

@Component({
  selector: 'app-users-page',
  imports: [ReactiveFormsModule, Button, Dialog, InputText, Password, TableModule, Tag],
  templateUrl: './users-page.html',
})
export class UsersPage implements OnInit {
  private readonly api = inject(UserService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly rows = signal<User[]>([]);
  readonly loading = signal(false);
  readonly dialogVisible = signal(false);
  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  ngOnInit(): void {
    this.reload();
  }

  openCreate(): void {
    this.form.reset({ name: '', email: '', password: '' });
    this.dialogVisible.set(true);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .create({
        name: v.name.trim(),
        email: v.email.trim(),
        password: v.password,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.dialogVisible.set(false);
          this.messages.add({ severity: 'success', summary: 'User created' });
          this.reload();
        },
        error: (err) => {
          this.saving.set(false);
          this.messages.add({
            severity: 'error',
            summary: 'Could not create user',
            detail: apiErrorMessage(err),
          });
        },
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
      accept: () => this.setActive(row.id, nextActive),
    });
  }

  isSelf(row: User): boolean {
    return this.auth.user()?.id === row.id;
  }

  private setActive(id: string, isActive: boolean): void {
    this.api.setActive(id, isActive).subscribe({
      next: () => {
        this.messages.add({
          severity: 'success',
          summary: isActive ? 'User activated' : 'User deactivated',
        });
        this.reload();
      },
      error: (err) => {
        this.messages.add({
          severity: 'error',
          summary: 'Could not update user',
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
          summary: 'Failed to load users',
          detail: apiErrorMessage(err),
        });
      },
    });
  }
}
