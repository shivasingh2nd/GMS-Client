import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Item } from '../../models/gms.models';

@Injectable({ providedIn: 'root' })
export class ItemService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/items`;

  list() {
    return this.http.get<Item[]>(this.base);
  }

  create(payload: { name: string; unit?: string; defaultRate?: number | null }) {
    return this.http.post<Item>(this.base, payload);
  }

  update(
    id: string,
    payload: Partial<{ name: string; unit?: string; defaultRate?: number | null }>,
  ) {
    return this.http.put<Item>(`${this.base}/${id}`, payload);
  }

  remove(id: string) {
    return this.http.delete<{ message: string }>(`${this.base}/${id}`);
  }
}
