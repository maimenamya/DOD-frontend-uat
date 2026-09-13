/** Local codes (employee login, package deposit customer) — 1–10 chars, alphanumeric + _- */
export const LOCAL_CODE_MIN_LENGTH = 1;
export const LOCAL_CODE_MAX_LENGTH = 10;
export const LOCAL_CODE_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

export function trimLocalCodeInput(value: string): string {
  return value.trim().replace(/\s+/g, '').slice(0, LOCAL_CODE_MAX_LENGTH);
}

export function normalizeLocalCodeForSubmit(value: string): string | null {
  const normalized = trimLocalCodeInput(value);
  if (
    normalized.length < LOCAL_CODE_MIN_LENGTH ||
    normalized.length > LOCAL_CODE_MAX_LENGTH ||
    !LOCAL_CODE_PATTERN.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

export const LOCAL_CODE_VALIDATORS_HINT =
  'ใช้ตัวอักษรภาษาอังกฤษ ตัวเลข ขีด (-) หรือขีดล่าง (_) ความยาว 1–10 ตัว — ตัวพิมพ์ใหญ่/เล็กต้องตรงตอนล็อกอิน';
