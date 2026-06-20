import { Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  CustomDropdownComponent,
  type DropdownOption,
} from '../custom-dropdown/custom-dropdown.component';
import { MASTER_PAGE_SIZE_OPTIONS } from '../../utils/master-list.util';

@Component({
  selector: 'app-list-paginator',
  imports: [FormsModule, CustomDropdownComponent],
  templateUrl: './list-paginator.component.html',
})
export class ListPaginatorComponent {
  readonly page = input(1);
  readonly totalPages = input(1);
  readonly total = input(0);
  readonly limit = input(25);
  readonly rangeStart = input(0);
  readonly rangeEnd = input(0);

  readonly pageChange = output<number>();
  readonly limitChange = output<number>();

  readonly pageSizeDropdownOptions: DropdownOption[] = MASTER_PAGE_SIZE_OPTIONS.map((size) => ({
    value: size,
    label: String(size),
  }));

  readonly canGoPrev = computed(() => this.page() > 1);
  readonly canGoNext = computed(() => this.page() < this.totalPages());

  goPrev(): void {
    if (this.canGoPrev()) this.pageChange.emit(this.page() - 1);
  }

  goNext(): void {
    if (this.canGoNext()) this.pageChange.emit(this.page() + 1);
  }

  onLimitChange(value: number | string | null): void {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) this.limitChange.emit(n);
  }
}
