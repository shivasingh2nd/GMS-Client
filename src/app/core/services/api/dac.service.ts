import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import {
  CreateDacPayload,
  CreateDacResponse,
  Dac,
  UpdateDacPayload,
} from '../../models/gms.models';

@Injectable({ providedIn: 'root' })
export class DacService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/dacs`;

  create(payload: CreateDacPayload) {
    return this.http.post<CreateDacResponse>(this.base, payload);
  }

  list(filters?: {
    from?: string;
    to?: string;
    distributor?: string;
    consumerNumber?: string;
    limit?: number;
  }) {
    let params = new HttpParams();
    if (filters?.from) params = params.set('from', filters.from);
    if (filters?.to) params = params.set('to', filters.to);
    if (filters?.distributor) params = params.set('distributor', filters.distributor);
    if (filters?.consumerNumber) params = params.set('consumerNumber', filters.consumerNumber);
    if (filters?.limit) params = params.set('limit', String(filters.limit));
    return this.http.get<Dac[]>(this.base, { params });
  }

  update(id: string, payload: UpdateDacPayload) {
    return this.http.put<Dac>(`${this.base}/${id}`, payload);
  }

  remove(id: string) {
    return this.http.delete<{ message: string }>(`${this.base}/${id}`);
  }
}
