import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import type { DashboardPreset, DashboardSummary, EmployeePerformanceRank } from '../../models/dashboard';
import { AuthService } from '../../services/auth.service';
import { DashboardService } from '../../services/dashboard.service';

@Component({
  selector: 'app-dashboard-page',
  imports: [DecimalPipe, FormsModule],
  templateUrl: './dashboard-page.component.html',
})
export class DashboardPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly dashboardService = inject(DashboardService);

  readonly user = computed(() => this.auth.getUser());
  readonly displayNickname = computed(() => this.auth.getDisplayNickname());
  readonly isPersonalView = computed(() => this.auth.isFieldStaff());
  readonly isSaleRole = computed(() => this.auth.getRole() === 'SALE');
  readonly isPrRole = computed(() => this.auth.getRole() === 'PR');

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly summary = signal<DashboardSummary | null>(null);

  readonly datePreset = signal<DashboardPreset>('today');
  readonly customFrom = signal('');
  readonly customTo = signal('');
  readonly saleSearch = signal('');
  readonly prSearch = signal('');

  readonly filteredTopSales = computed(() =>
    this.filterLeaderboard(this.summary()?.topSales ?? [], this.saleSearch()),
  );

  readonly filteredTopPr = computed(() =>
    this.filterLeaderboard(this.summary()?.topPr ?? [], this.prSearch()),
  );

  ngOnInit(): void {
    this.loadSummary();
  }

  selectPreset(preset: DashboardPreset): void {
    this.datePreset.set(preset);
    if (preset !== 'custom') {
      this.loadSummary();
    }
  }

  applyCustomRange(): void {
    if (!this.customFrom() || !this.customTo()) {
      return;
    }
    this.datePreset.set('custom');
    this.loadSummary();
  }

  loadSummary(): void {
    const shopId = this.auth.getShopId();
    if (shopId == null) {
      this.error.set('ไม่พบข้อมูลร้าน กรุณาเข้าสู่ระบบใหม่');
      this.loading.set(false);
      return;
    }

    const preset = this.datePreset();
    if (preset === 'custom' && (!this.customFrom() || !this.customTo())) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.dashboardService
      .getSummary({
        shopId,
        preset,
        from: preset === 'custom' ? this.customFrom() : undefined,
        to: preset === 'custom' ? this.customTo() : undefined,
      })
      .subscribe({
        next: (data) => {
          this.summary.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('ไม่สามารถโหลดข้อมูล Dashboard ได้');
          this.loading.set(false);
        },
      });
  }

  private filterLeaderboard(
    rows: EmployeePerformanceRank[],
    query: string,
  ): EmployeePerformanceRank[] {
    const term = query.trim().toLowerCase();
    if (!term) {
      return rows;
    }
    return rows.filter(
      (row) =>
        row.nickname.toLowerCase().includes(term) ||
        row.employeeId.toLowerCase().includes(term),
    );
  }
}
