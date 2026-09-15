import { Directive, ElementRef, HostListener, inject } from '@angular/core';
import { NgControl } from '@angular/forms';

/** Forces alphabetic characters to uppercase while typing (digits/symbols unchanged). */
@Directive({
  selector: 'input[gmsUppercase], textarea[gmsUppercase]',
})
export class UppercaseInputDirective {
  private readonly el = inject(ElementRef<HTMLInputElement | HTMLTextAreaElement>);
  private readonly ngControl = inject(NgControl, { optional: true, self: true });

  @HostListener('input')
  onInput(): void {
    const input = this.el.nativeElement;
    const upper = input.value.toLocaleUpperCase('en-IN');
    if (input.value === upper) return;

    const start = input.selectionStart;
    const end = input.selectionEnd;
    input.value = upper;
    this.ngControl?.control?.setValue(upper, { emitEvent: true });
    if (start != null && end != null) {
      input.setSelectionRange(start, end);
    }
  }
}

/** Uppercase letters in a string; leaves digits and other characters as-is. */
export function toUpperAlpha(value: string): string {
  return value.toLocaleUpperCase('en-IN');
}
