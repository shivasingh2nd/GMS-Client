import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Distributor } from '../../models/gms.models';

@Injectable({ providedIn: 'root' })
export class DistributorService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/distributors`;

  list(companyId?: string) {
    let params = new HttpParams();
    if (companyId) {
      params = params.set('company', companyId);
    }
    return this.http.get<Distributor[]>(this.base, { params });
  }

  create(payload: { company: string; name: string; address: string; phone?: string }) {
    return this.http.post<Distributor>(this.base, payload);
  }

  update(
    id: string,
    payload: Partial<{ company: string; name: string; address: string; phone?: string }>,
  ) {
    return this.http.put<Distributor>(`${this.base}/${id}`, payload);
  }

  remove(id: string) {
    return this.http.delete<{ message: string }>(`${this.base}/${id}`);
  }
}
