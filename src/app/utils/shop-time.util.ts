/** Normalize wall-clock HH:mm for shop policy (24-hour, Thailand). */
export function normalizeShopTimeHm(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!match) return trimmed;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour + minute) || hour > 23 || minute > 59) {
    return trimmed;
  }

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function isValidShopTimeHm(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return normalizeShopTimeHm(trimmed) === trimmed && /^(\d{2}):(\d{2})$/.test(trimmed);
}
