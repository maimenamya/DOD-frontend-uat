import type { BeverageCategoryKind } from '../models/beverage';

export const BEVERAGE_CATEGORY_KIND_OPTIONS: Array<{
  value: BeverageCategoryKind;
  label: string;
}> = [
  { value: 'LIQUOR', label: 'เหล้า' },
  { value: 'BEER', label: 'เบียร์' },
  { value: 'WINE', label: 'ไวน์' },
  { value: 'MIXER', label: 'มิกซ์เซอร์' },
];

export function isMixerCategoryKind(kind: BeverageCategoryKind | string): boolean {
  return kind === 'MIXER';
}

export function beverageCategoryKindLabel(kind: BeverageCategoryKind | string): string {
  const match = BEVERAGE_CATEGORY_KIND_OPTIONS.find((row) => row.value === kind);
  if (match) return match.label;
  if (kind === 'SALE' || kind === 'OTHER' || kind === 'COCKTAIL') return 'เครื่องดื่ม';
  return String(kind);
}

export function defaultBeverageCategoryKind(): BeverageCategoryKind {
  return 'LIQUOR';
}

export function normalizeBeverageCategoryKind(kind: BeverageCategoryKind | string): BeverageCategoryKind {
  if (kind === 'MIXER' || kind === 'BEER' || kind === 'LIQUOR' || kind === 'WINE') {
    return kind;
  }
  return 'LIQUOR';
}
