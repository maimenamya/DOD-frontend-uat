import { FormControl, FormGroup, NonNullableFormBuilder, Validators } from '@angular/forms';

import type { MstBeverage, MstBeverageCategory } from '../models/beverage';
import type { DrinkPackageLine } from '../models/master-data';
import type { DropdownOption } from '../components/custom-dropdown/custom-dropdown.component';

export type DrinkPackageLineForm = FormGroup<{
  categoryId: FormControl<number>;
  drinkId: FormControl<number>;
  quantity: FormControl<string>;
}>;

export function drinkOptionsForCategory(
  beverages: MstBeverage[],
  categoryId: number | null,
): DropdownOption[] {
  if (categoryId == null || categoryId <= 0) return [];
  return beverages
    .filter((b) => b.categoryId === categoryId)
    .map((b) => ({ value: b.id, label: b.name }));
}

export function createDrinkPackageLineForm(
  fb: NonNullableFormBuilder,
  beverages: MstBeverage[],
  categories: MstBeverageCategory[],
  seed?: { drinkId: number; quantity: number },
): DrinkPackageLineForm {
  const beverage = seed
    ? beverages.find((b) => b.id === seed.drinkId)
    : beverages.find((b) => b.categoryId === categories[0]?.id);
  const categoryId = beverage?.categoryId ?? categories[0]?.id ?? 0;
  const drinkOptions = drinkOptionsForCategory(beverages, categoryId);
  const drinkId =
    seed?.drinkId ??
    (typeof drinkOptions[0]?.value === 'number' ? drinkOptions[0].value : 0);

  return fb.group({
    categoryId: [categoryId, [Validators.required, Validators.min(1)]],
    drinkId: [drinkId, [Validators.required, Validators.min(1)]],
    quantity: [seed ? String(seed.quantity) : '', [Validators.required, Validators.pattern(/^\d+$/)]],
  });
}

export function syncDrinkPackageLineDrinkId(
  row: DrinkPackageLineForm,
  beverages: MstBeverage[],
): void {
  const options = drinkOptionsForCategory(beverages, row.controls.categoryId.value);
  const current = row.controls.drinkId.value;
  if (current > 0 && options.some((o) => o.value === current)) return;
  const first = options[0]?.value;
  row.controls.drinkId.setValue(typeof first === 'number' ? first : 0);
}

export function drinkPackageItemsFromForm(
  lines: DrinkPackageLineForm[],
): { drinkId: number; quantity: number }[] {
  return lines.map((row) => ({
    drinkId: row.controls.drinkId.value,
    quantity: Number.parseInt(row.controls.quantity.value, 10),
  }));
}

export function seedDrinkPackageLineForms(
  fb: NonNullableFormBuilder,
  beverages: MstBeverage[],
  categories: MstBeverageCategory[],
  items: DrinkPackageLine[],
): DrinkPackageLineForm[] {
  if (items.length === 0) {
    return [createDrinkPackageLineForm(fb, beverages, categories)];
  }
  return items.map((item) =>
    createDrinkPackageLineForm(fb, beverages, categories, {
      drinkId: item.drinkId,
      quantity: item.quantity,
    }),
  );
}
