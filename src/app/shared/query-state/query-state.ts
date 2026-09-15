import { Component, input, output } from '@angular/core';
import { Button } from 'primeng/button';

/** Shared pending / error / empty messaging for query-backed pages. */
@Component({
  selector: 'app-query-state',
  imports: [Button],
  template: `
    @if (error()) {
      <div class="gms-empty" role="alert">
        <i class="pi pi-exclamation-circle text-[#b94a43]"></i>
        <p class="font-medium text-[var(--gms-ink)]">{{ errorTitle() }}</p>
        <p class="text-sm">{{ errorDetail() || 'Something went wrong. Try again.' }}</p>
        <p-button
          class="mt-3"
          label="Retry"
          icon="pi pi-refresh"
          severity="secondary"
          [outlined]="true"
          (onClick)="retry.emit()"
        />
      </div>
    } @else if (pending()) {
      <div class="gms-empty" role="status" aria-live="polite">
        <i class="pi pi-spin pi-spinner"></i>
        <p class="font-medium text-[var(--gms-ink)]">{{ pendingTitle() }}</p>
      </div>
    } @else if (empty()) {
      <div class="gms-empty">
        <i [class]="emptyIcon()"></i>
        <p class="font-medium text-[var(--gms-ink)]">{{ emptyTitle() }}</p>
        @if (emptyDetail()) {
          <p class="text-sm">{{ emptyDetail() }}</p>
        }
      </div>
    }
  `,
})
export class QueryState {
  readonly pending = input(false);
  readonly error = input(false);
  readonly empty = input(false);
  readonly pendingTitle = input('Loading…');
  readonly errorTitle = input('Failed to load');
  readonly errorDetail = input('');
  readonly emptyTitle = input('Nothing here yet');
  readonly emptyDetail = input('');
  readonly emptyIcon = input('pi pi-inbox');
  readonly retry = output<void>();
}
