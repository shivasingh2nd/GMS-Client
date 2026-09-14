import { MessageService } from 'primeng/api';

/** Toast when a form is submitted without required fields. */
export function toastMissingRequired(messages: MessageService): void {
  messages.add({
    severity: 'warn',
    summary: 'Required fields missing',
    detail: 'Please fill all mandatory fields marked with *',
  });
}
