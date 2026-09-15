import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import {
  Consumer,
  ConsumerListResponse,
  ConsumerLookupResult,
} from '../../models/gms.models';
import type { ConsumerListFilters } from '../../query/query-keys';

function normalizeListResponse(
  data: ConsumerListResponse | Consumer[],
  filters?: ConsumerListFilters,
): ConsumerListResponse {
  if (Array.isArray(data)) {
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 50;
    const start = (page - 1) * limit;
    return {
      items: data.slice(start, start + limit),
      total: data.length,
      page,
      limit,
    };
  }
  return {
    items: data.items ?? [],
    total: data.total ?? data.items?.length ?? 0,
    page: data.page ?? filters?.page ?? 1,
    limit: data.limit ?? filters?.limit ?? 50,
  };
}

@Injectable({ providedIn: 'root' })
export class ConsumerService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/consumers`;

  list(filters?: ConsumerListFilters) {
    let params = new HttpParams();
    if (filters?.distributor) params = params.set('distributor', filters.distributor);
    if (filters?.consumerNumber) {
      params = params.set('consumerNumber', filters.consumerNumber);
    }
    if (filters?.phone) params = params.set('phone', filters.phone);
    if (filters?.name) params = params.set('name', filters.name);
    if (filters?.page != null) params = params.set('page', String(filters.page));
    if (filters?.limit != null) params = params.set('limit', String(filters.limit));
    return this.http
      .get<ConsumerListResponse | Consumer[]>(this.base, { params })
      .pipe(map((data) => normalizeListResponse(data, filters)));
  }

  lookup(distributorId: string, consumerNumber: string) {
    const params = new HttpParams()
      .set('distributorId', distributorId)
      .set('consumerNumber', consumerNumber);
    return this.http.get<ConsumerLookupResult>(`${this.base}/lookup`, { params });
  }

  create(payload: {
    distributor: string;
    consumerNumber: string;
    name: string;
    fatherName?: string;
    phone?: string;
    address?: string;
  }) {
    return this.http.post<Consumer>(this.base, payload);
  }

  update(
    id: string,
    payload: Partial<{
      distributor: string;
      consumerNumber: string;
      name: string;
      fatherName?: string;
      phone?: string;
      address?: string;
    }>,
  ) {
    return this.http.put<Consumer>(`${this.base}/${id}`, payload);
  }

  remove(id: string) {
    return this.http.delete<{ message: string }>(`${this.base}/${id}`);
  }
}
