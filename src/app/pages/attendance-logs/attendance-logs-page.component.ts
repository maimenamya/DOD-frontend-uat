import { Component, OnInit, computed, inject, signal } from '@angular/core';

import type { AttendanceLogRow } from '../../models/attendance';
import { AttendanceService } from '../../services/attendance.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { attendanceKioskUrl } from '../../utils/attendance-kiosk-url.util';

@Component({
  selector: 'app-attendance-logs-page',
  templateUrl: './attendance-logs-page.component.html',
})
export class AttendanceLogsPageComponent implements OnInit {
  private readonly attendance = inject(AttendanceService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly items = signal<AttendanceLogRow[]>([]);
  readonly branchKiosks = computed(() => {
    this.auth.session();
    const branches = this.auth.getAvailableBranches();
    const mapped = branches
      .map((branch) => {
        const publicId = branch.publicId?.trim();
        if (!publicId) return null;
        return {
          shopId: branch.shopId,
          branchName: branch.branchName,
          branchCode: branch.branchCode,
          url: attendanceKioskUrl(publicId),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);

    if (mapped.length > 0) {
      return mapped;
    }

    const publicId = this.auth.getShopPublicId();
    if (!publicId) return [];
    return [
      {
        shopId: this.auth.getShopId() ?? 0,
        branchName: this.auth.getShopDisplayName(),
        branchCode: '',
        url: attendanceKioskUrl(publicId),
      },
    ];
  });

  ngOnInit(): void {
    if (this.auth.getAvailableBranches().length === 0) {
      this.auth.fetchAccessibleBranches().subscribe({
        error: () => {
          // ใช้สาขาจาก session เป็นทางเลือกสำรอง
        },
      });
    }
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.attendance.listTodayLogs().subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.loading.set(false);
      },
      error: () => {
        this.toast.showError('โหลดรายการลงเวลาไม่สำเร็จ');
        this.loading.set(false);
      },
    });
  }

  copyKioskUrl(url: string): void {
    if (!url) {
      this.toast.showError('ไม่พบลิงก์ร้านสำหรับจุดลงเวลา');
      return;
    }
    void navigator.clipboard.writeText(url).then(
      () => this.toast.showSuccess('คัดลอกลิงก์จุดลงเวลาแล้ว'),
      () => this.toast.showError('คัดลอกลิงก์ไม่สำเร็จ'),
    );
  }
}
