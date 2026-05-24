import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';

import type { DashboardStats } from '../../models/dashboard';
import { AuthService } from '../../services/auth.service';
import { DashboardService } from '../../services/dashboard.service';

@Component({
  selector: 'app-dashboard-page',
  imports: [DecimalPipe],
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
  readonly stats = signal<DashboardStats | null>(null);

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    const shopId = this.auth.getShopId();
    if (shopId == null) {
      this.error.set('ไม่พบข้อมูลร้าน กรุณาเข้าสู่ระบบใหม่');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.dashboardService.getStats(shopId).subscribe({
      next: (data) => {
        this.stats.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('ไม่สามารถโหลดข้อมูล Dashboard ได้');
        this.loading.set(false);
      },
    });
  }
}
