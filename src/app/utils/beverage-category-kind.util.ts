import type { BeverageCategoryKind } from '../models/beverage';

export function isMixerCategoryKind(kind: BeverageCategoryKind | string): boolean {
  return kind === 'MIXER';
}
