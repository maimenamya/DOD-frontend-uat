import { Component, computed, input, output } from '@angular/core';

import { MASTER_PAGE_SIZE_OPTIONS } from '../../utils/master-list.util';

@Component({
  selector: 'app-list-paginator',
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

  readonly pageSizeOptions = MASTER_PAGE_SIZE_OPTIONS;

  readonly canGoPrev = computed(() => this.page() > 1);
  readonly canGoNext = computed(() => this.page() < this.totalPages());

  goPrev(): void {
    if (this.canGoPrev()) this.pageChange.emit(this.page() - 1);
  }

  goNext(): void {
    if (this.canGoNext()) this.pageChange.emit(this.page() + 1);
  }

  onLimitSelect(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    if (Number.isFinite(value) && value > 0) this.limitChange.emit(value);
  }
}
