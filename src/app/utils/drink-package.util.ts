import type { DrinkPackageLine } from '../models/master-data';

export function drinkPackageItemsSummary(items: DrinkPackageLine[] | undefined): string {
  if (!items?.length) return '—';
  return items
    .map((row) => `${row.drink?.name?.trim() || '—'} ×${row.quantity}`)
    .join(', ');
}

export function drinkPackageItemsSearchText(items: DrinkPackageLine[] | undefined): string {
  return drinkPackageItemsSummary(items).replace(/,/g, ' ');
}
