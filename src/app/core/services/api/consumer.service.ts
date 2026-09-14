import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Consumer, ConsumerLookupResult } from '../../models/gms.models';

@Injectable({ providedIn: 'root' })
export class ConsumerService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/consumers`;

  list(distributorId?: string) {
    let params = new HttpParams();
    if (distributorId) {
      params = params.set('distributor', distributorId);
    }
    return this.http.get<Consumer[]>(this.base, { params });
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
