import { type Signal, computed, signal } from '@angular/core';

export const DEFAULT_MASTER_PAGE_SIZE = 10;
export const MASTER_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export type MasterListSlice<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
};

export class MasterListQueryState {
  readonly search = signal('');
  readonly page = signal(1);
  readonly limit = signal(DEFAULT_MASTER_PAGE_SIZE);

  onSearchChange(value: string): void {
    this.search.set(value);
    this.page.set(1);
  }

  goToPage(page: number): void {
    this.page.set(Math.max(1, page));
  }

  onLimitChange(limit: number): void {
    this.limit.set(limit);
    this.page.set(1);
  }

  resetPage(): void {
    this.page.set(1);
  }
}

export function filterMasterRows<T>(
  rows: readonly T[],
  search: string,
  searchText: (row: T) => string,
): T[] {
  const q = search.trim().toLowerCase();
  if (!q) return [...rows];
  return rows.filter((row) => searchText(row).toLowerCase().includes(q));
}

export function paginateMasterRows<T>(
  rows: readonly T[],
  page: number,
  limit: number,
): MasterListSlice<T> {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * limit;
  const items = rows.slice(start, start + limit);
  const rangeStart = total === 0 ? 0 : start + 1;
  const rangeEnd = total === 0 ? 0 : start + items.length;
  return {
    items,
    total,
    page: safePage,
    limit,
    totalPages,
    rangeStart,
    rangeEnd,
  };
}

export function createMasterListView<T>(
  source: Signal<readonly T[]>,
  query: MasterListQueryState,
  searchText: (row: T) => string,
): Signal<MasterListSlice<T>> {
  return computed(() => {
    const filtered = filterMasterRows(source(), query.search(), searchText);
    return paginateMasterRows(filtered, query.page(), query.limit());
  });
}

export function masterListRowNumber(slice: MasterListSlice<unknown>, index: number): number {
  return (slice.page - 1) * slice.limit + index + 1;
}
