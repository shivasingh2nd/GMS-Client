import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { MessageService } from 'primeng/api';
import { normalizeApiError } from '../utils/api-error';

let sessionExpiredToastShown = false;

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const messages = inject(MessageService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const normalized = normalizeApiError(err);

      if (err.status === 401 && !req.url.includes('/auth/') && auth.isAuthenticated) {
        if (!sessionExpiredToastShown) {
          sessionExpiredToastShown = true;
          messages.add({
            severity: 'warn',
            summary: 'Session expired',
            detail: 'Please sign in again',
          });
          setTimeout(() => {
            sessionExpiredToastShown = false;
          }, 3000);
        }
        auth.logout();
      }

      return throwError(() => ({
        ...normalized,
        error: { message: normalized.message },
      }));
    }),
  );
};
