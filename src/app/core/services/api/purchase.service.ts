import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { CreatePurchasePayload, Purchase, PurchaseLinePayload } from '../../models/gms.models';

@Injectable({ providedIn: 'root' })
export class PurchaseService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/purchases`;

  list(filters?: { distributor?: string; from?: string; to?: string; item?: string }) {
    let params = new HttpParams();
    if (filters?.distributor) params = params.set('distributor', filters.distributor);
    if (filters?.from) params = params.set('from', filters.from);
    if (filters?.to) params = params.set('to', filters.to);
    if (filters?.item) params = params.set('item', filters.item);
    return this.http.get<Purchase[]>(this.base, { params });
  }

  create(payload: CreatePurchasePayload) {
    return this.http.post<Purchase>(this.base, payload);
  }

  update(
    id: string,
    payload: Partial<{
      distributor: string;
      purchaseDate: string;
      invoiceNumber?: string;
      items: PurchaseLinePayload[];
      totalAmount?: number;
      remarks?: string;
    }>,
  ) {
    return this.http.put<Purchase>(`${this.base}/${id}`, payload);
  }

  remove(id: string) {
    return this.http.delete<{ message: string }>(`${this.base}/${id}`);
  }
}
