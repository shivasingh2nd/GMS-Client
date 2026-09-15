import { Component, ElementRef, inject, output, signal, viewChild } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import {
  hasHpPayConsumerFields,
  HpPayConsumerFields,
  parseHpPayProfileText,
} from '../../core/utils/hp-pay-profile';
import { recognizeImageText } from '../../core/utils/ocr-image';

@Component({
  selector: 'app-hp-pay-screenshot-upload',
  imports: [Button],
  template: `
    <div class="rounded-lg border border-dashed border-[var(--gms-line)] bg-[var(--gms-surface-soft,#f8faf9)] px-3 py-3">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-[var(--gms-ink)]">HP PAY screenshot</p>
          <p class="mt-0.5 text-xs leading-snug text-[var(--gms-muted)]">
            Upload a Customer Profile screenshot to prefill name, number, phone, and address.
            Distributor and father name stay manual.
          </p>
        </div>
        <p-button
          type="button"
          [label]="ocrBusy() ? 'Reading…' : 'Upload screenshot'"
          icon="pi pi-camera"
          severity="secondary"
          [outlined]="true"
          [loading]="ocrBusy()"
          [disabled]="ocrBusy()"
          (onClick)="openFilePicker()"
        />
      </div>
      <input
        #screenshotInput
        type="file"
        class="hidden"
        accept="image/*"
        (change)="onFileSelected($event)"
      />
      @if (fileName()) {
        <p class="mt-2 truncate text-xs text-[var(--gms-muted)]">{{ fileName() }}</p>
      }
    </div>
  `,
})
export class HpPayScreenshotUpload {
  private readonly messages = inject(MessageService);
  private readonly screenshotInput =
    viewChild.required<ElementRef<HTMLInputElement>>('screenshotInput');

  readonly extracted = output<HpPayConsumerFields>();
  readonly ocrBusy = signal(false);
  readonly fileName = signal<string | null>(null);

  openFilePicker(): void {
    this.screenshotInput().nativeElement.click();
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.messages.add({
        severity: 'warn',
        summary: 'Invalid file',
        detail: 'Please upload an image screenshot.',
      });
      return;
    }

    this.fileName.set(file.name);
    this.ocrBusy.set(true);

    try {
      const text = await recognizeImageText(file);
      const fields = parseHpPayProfileText(text);

      if (!hasHpPayConsumerFields(fields)) {
        this.messages.add({
          severity: 'warn',
          summary: 'No consumer data found',
          detail: 'Could not read HP PAY fields. Try a clearer screenshot, or fill the form manually.',
        });
        return;
      }

      this.extracted.emit(fields);
      this.messages.add({
        severity: 'success',
        summary: 'Fields prefilled',
        detail: 'Review the values, then add distributor and father name before saving.',
      });
    } catch (error) {
      console.error('HP PAY screenshot OCR failed', error);
      this.messages.add({
        severity: 'error',
        summary: 'Could not read screenshot',
        detail: 'OCR failed in the browser. Try another image or enter details manually.',
      });
    } finally {
      this.ocrBusy.set(false);
    }
  }
}
