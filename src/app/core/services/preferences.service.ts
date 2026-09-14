import { Injectable, signal } from '@angular/core';

const CONSUMER_DISTRIBUTOR_KEY = 'gms_default_consumer_distributor';
const BOOKING_DISTRIBUTOR_KEY = 'gms_default_booking_distributor';

@Injectable({ providedIn: 'root' })
export class PreferencesService {
  readonly defaultConsumerDistributorId = signal<string | null>(
    localStorage.getItem(CONSUMER_DISTRIBUTOR_KEY),
  );
  readonly defaultBookingDistributorId = signal<string | null>(
    localStorage.getItem(BOOKING_DISTRIBUTOR_KEY),
  );

  setDefaultConsumerDistributor(id: string | null): void {
    this.persist(CONSUMER_DISTRIBUTOR_KEY, id, this.defaultConsumerDistributorId);
  }

  setDefaultBookingDistributor(id: string | null): void {
    this.persist(BOOKING_DISTRIBUTOR_KEY, id, this.defaultBookingDistributorId);
  }

  private persist(
    key: string,
    id: string | null,
    target: ReturnType<typeof signal<string | null>>,
  ): void {
    if (id) {
      localStorage.setItem(key, id);
    } else {
      localStorage.removeItem(key);
    }
    target.set(id);
  }
}
