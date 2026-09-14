import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Password } from 'primeng/password';
import { Toast } from 'primeng/toast';
import { AuthService } from '../../../core/services/auth.service';
import { apiErrorMessage } from '../../../core/utils/api-error';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, Button, InputText, Password, Toast],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);

  readonly submitting = signal(false);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const { email, password } = this.form.getRawValue();

    this.auth.login(email, password).subscribe({
      next: () => {
        this.submitting.set(false);
        void this.router.navigateByUrl('/dashboard');
      },
      error: (err) => {
        this.submitting.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'Sign in failed',
          detail: apiErrorMessage(err, 'Please check your credentials'),
        });
      },
    });
  }
}
