import { Component, Input } from '@angular/core';

/**
 * Skeleton placeholder that mirrors the real master-list layout:
 * optional filter tabs + search toolbar + a data table (header + rows)
 * with the same column count as the loaded content.
 */
@Component({
  selector: 'app-master-list-skeleton',
  standalone: true,
  template: `
    <div aria-busy="true" [attr.aria-label]="ariaLabel">
      @if (tabs > 0) {
        <div class="app-filter-bar" aria-hidden="true">
          @for (t of tabsArr; track $index) {
            <span class="app-skeleton-chip"></span>
          }
        </div>
      }
      @if (toolbar) {
        <div class="app-master-list-toolbar" aria-hidden="true">
          <span class="app-skeleton-search"></span>
        </div>
      }
      <section class="app-card app-card-flush" aria-hidden="true">
        <div class="app-data-table-shell">
          <table class="app-data-table app-skeleton-table">
            <thead>
              <tr>
                @for (c of colsArr; track $index) {
                  <th><span class="app-skeleton-bar app-skeleton-bar--head"></span></th>
                }
              </tr>
            </thead>
            <tbody>
              @for (r of rowsArr; track $index) {
                <tr>
                  @for (c of colsArr; track $index) {
                    <td><span class="app-skeleton-bar"></span></td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `,
})
export class MasterListSkeletonComponent {
  @Input() tabs = 0;
  @Input() toolbar = true;
  @Input() columns = 4;
  @Input() rows = 8;
  @Input() ariaLabel = 'กำลังโหลด';

  get tabsArr(): unknown[] {
    return Array.from({ length: Math.max(0, this.tabs) });
  }

  get colsArr(): unknown[] {
    return Array.from({ length: Math.max(1, this.columns) });
  }

  get rowsArr(): unknown[] {
    return Array.from({ length: Math.max(1, this.rows) });
  }
}
