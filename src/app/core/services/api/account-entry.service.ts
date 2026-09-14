import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { AccountEntry, AccountEntryType } from '../../models/gms.models';

@Injectable({ providedIn: 'root' })
export class AccountEntryService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/accounts/entries`;

  list(filters?: { party?: string; from?: string; to?: string; limit?: number }) {
    let params = new HttpParams();
    if (filters?.party) params = params.set('party', filters.party);
    if (filters?.from) params = params.set('from', filters.from);
    if (filters?.to) params = params.set('to', filters.to);
    if (filters?.limit) params = params.set('limit', String(filters.limit));
    return this.http.get<AccountEntry[]>(this.base, { params });
  }

  create(payload: {
    party: string;
    date: string;
    type: AccountEntryType;
    amount: number;
    particular?: string;
  }) {
    return this.http.post<AccountEntry>(this.base, payload);
  }

  update(
    id: string,
    payload: Partial<{
      party: string;
      date: string;
      type: AccountEntryType;
      amount: number;
      particular?: string;
    }>,
  ) {
    return this.http.put<AccountEntry>(`${this.base}/${id}`, payload);
  }

  remove(id: string) {
    return this.http.delete<{ message: string }>(`${this.base}/${id}`);
  }
}
