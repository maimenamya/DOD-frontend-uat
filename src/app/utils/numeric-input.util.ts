/** Strip non-digits; keep at least one digit when user clears (empty string allowed). */
export function sanitizeDigitsOnly(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function parsePositiveIntFromText(value: string, fallback = 1): number {
  const digits = sanitizeDigitsOnly(value);
  if (!digits) return fallback;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

export function blockNonNumericInputKey(event: KeyboardEvent): void {
  const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
  if (allowed.includes(event.key)) return;
  if (event.ctrlKey || event.metaKey) return;
  if (/^\d$/.test(event.key)) return;
  event.preventDefault();
}
