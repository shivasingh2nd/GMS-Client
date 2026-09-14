import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { AccountLedgerResponse, AccountSummaryResponse } from '../../models/gms.models';

@Injectable({ providedIn: 'root' })
export class AccountReportService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/accounts`;

  summary() {
    return this.http.get<AccountSummaryResponse>(`${this.base}/summary`);
  }

  ledger(filters: { party: string; from?: string; to?: string }) {
    let params = new HttpParams().set('party', filters.party);
    if (filters.from) params = params.set('from', filters.from);
    if (filters.to) params = params.set('to', filters.to);
    return this.http.get<AccountLedgerResponse>(`${this.base}/ledger`, { params });
  }
}
