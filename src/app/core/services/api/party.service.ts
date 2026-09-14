import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Party } from '../../models/gms.models';

@Injectable({ providedIn: 'root' })
export class PartyService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/accounts/parties`;

  list() {
    return this.http.get<Party[]>(this.base);
  }

  create(payload: {
    name: string;
    phone?: string;
    notes?: string;
    openingBalance?: number;
  }) {
    return this.http.post<Party>(this.base, payload);
  }

  update(
    id: string,
    payload: Partial<{
      name: string;
      phone?: string;
      notes?: string;
      openingBalance?: number;
    }>,
  ) {
    return this.http.put<Party>(`${this.base}/${id}`, payload);
  }

  remove(id: string) {
    return this.http.delete<{ message: string }>(`${this.base}/${id}`);
  }
}
