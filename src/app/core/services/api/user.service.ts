import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { User } from '../../models/gms.models';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/users`;

  list() {
    return this.http.get<User[]>(this.base);
  }

  create(payload: { name: string; email: string; password: string }) {
    return this.http.post<User>(this.base, payload);
  }

  setActive(id: string, isActive: boolean) {
    return this.http.patch<User>(`${this.base}/${id}/active`, { isActive });
  }
}
