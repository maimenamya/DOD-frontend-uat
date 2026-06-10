export type DrinkAccrualMode = 'HOUR_BLOCKS' | 'MINUTE_LINEAR';
export type DrinkAccrualRounding = 'FLOOR' | 'CEIL';

export function resolveDrinkAccrualMode(mode?: DrinkAccrualMode | null): DrinkAccrualMode {
  return mode ?? 'HOUR_BLOCKS';
}

export function resolveDrinkAccrualRounding(
  rounding?: DrinkAccrualRounding | null,
): DrinkAccrualRounding {
  return rounding ?? 'FLOOR';
}

export function applyDrinkAccrualRounding(
  raw: number,
  rounding: DrinkAccrualRounding,
): number {
  if (rounding === 'CEIL') return Math.ceil(raw);
  return Math.floor(raw);
}

export function accrualDrinksFromSeatedMinutes(
  minutes: number,
  drinksPerHour: number,
  mode: DrinkAccrualMode,
  rounding: DrinkAccrualRounding,
): number {
  if (minutes <= 0 || drinksPerHour <= 0) return 0;
  const raw =
    mode === 'HOUR_BLOCKS'
      ? drinksPerHour * Math.floor(minutes / 60)
      : drinksPerHour * (minutes / 60);
  return applyDrinkAccrualRounding(raw, rounding);
}

/** One-line preview for master-role drink policy form. */
export function drinkAccrualPreviewLine(
  drinksPerHour: number,
  mode: DrinkAccrualMode,
  rounding: DrinkAccrualRounding,
): string {
  const rate = Number.isFinite(drinksPerHour) && drinksPerHour > 0 ? drinksPerHour : 0;
  if (rate <= 0) {
    return 'ตั้งดื่มต่อชั่วโมงเพื่อดูตัวอย่าง';
  }
  const samples = [30, 20] as const;
  const parts = samples.map((minutes) => {
    const drinks = accrualDrinksFromSeatedMinutes(minutes, rate, mode, rounding);
    if (mode === 'MINUTE_LINEAR' && minutes === 20 && rounding === 'FLOOR') {
      return `นั่ง ${minutes} นาที → ${drinks} ดื่ม (ปัดทิ้ง)`;
    }
    return `นั่ง ${minutes} นาที → ${drinks} ดื่ม`;
  });
  return parts.join(' · ');
}

export const DRINK_ACCRUAL_MODE_OPTIONS = [
  { value: 'MINUTE_LINEAR' as const, label: 'ตามนาที (15 นาที ≈ 1/4 ชม.)' },
  { value: 'HOUR_BLOCKS' as const, label: 'ครบชั่วโมงเท่านั้น' },
];

export const DRINK_ACCRUAL_ROUNDING_OPTIONS = [
  { value: 'FLOOR' as const, label: 'ปัดทิ้ง' },
  { value: 'CEIL' as const, label: 'ปัดขึ้น' },
];
