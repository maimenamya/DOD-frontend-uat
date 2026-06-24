import { Component, input } from '@angular/core';
import { FormArray, FormsModule, ReactiveFormsModule } from '@angular/forms';

import {
  CustomDropdownComponent,
  type DropdownOption,
} from '../custom-dropdown/custom-dropdown.component';
import type { MstBeverage, MstBeverageCategory } from '../../models/beverage';
import {
  drinkOptionsForCategory,
  syncDrinkPackageLineDrinkId,
  type DrinkPackageLineForm,
} from '../../utils/drink-package-form.util';

@Component({
  selector: 'app-drink-package-lines-editor',
  imports: [FormsModule, ReactiveFormsModule, CustomDropdownComponent],
  templateUrl: './drink-package-lines-editor.component.html',
  styleUrl: './drink-package-lines-editor.component.css',
})
export class DrinkPackageLinesEditorComponent {
  readonly beverages = input.required<MstBeverage[]>();
  readonly categories = input.required<MstBeverageCategory[]>();
  readonly lines = input.required<FormArray<DrinkPackageLineForm>>();

  categoryOptions(): DropdownOption[] {
    return this.categories().map((c) => ({ value: c.id, label: c.name }));
  }

  drinkOptionsForRow(row: DrinkPackageLineForm): DropdownOption[] {
    return drinkOptionsForCategory(this.beverages(), row.controls.categoryId.value);
  }

  onCategoryChange(row: DrinkPackageLineForm, value: number | string | null): void {
    const id = value == null || value === '' ? null : Number(value);
    if (id == null || !Number.isFinite(id)) return;
    row.controls.categoryId.setValue(id);
    syncDrinkPackageLineDrinkId(row, this.beverages());
  }

  sanitizeQuantity(row: DrinkPackageLineForm, event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/\D+/g, '');
    row.controls.quantity.setValue(sanitized, { emitEvent: false });
  }

  removeLine(index: number): void {
    const lines = this.lines();
    if (lines.length <= 1) return;
    lines.removeAt(index);
  }
}
