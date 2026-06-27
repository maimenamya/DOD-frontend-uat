import { Component, OnInit, computed, inject, signal } from '@angular/core';

import type { AttendanceMePayload } from '../../models/attendance';
import { AttendanceService } from '../../services/attendance.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-attendance-check-in-page',
  templateUrl: './attendance-check-in-page.component.html',
})
export class AttendanceCheckInPageComponent implements OnInit {
  private readonly attendance = inject(AttendanceService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly payload = signal<AttendanceMePayload | null>(null);

  readonly nextPunchLabel = computed(() => {
    const status = this.payload()?.attendanceStatus;
    if (!status) return null;
    return status === 'OFF_DUTY' ? 'เข้างาน' : 'ออกงาน';
  });

  readonly employeeNickname = computed(() => this.auth.getUser()?.nickname?.trim() ?? '');

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.attendance.getMe().subscribe({
      next: (data) => {
        this.payload.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.toast.showError('โหลดสถานะลงเวลาไม่สำเร็จ');
        this.loading.set(false);
      },
    });
  }
}
