import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';

import { AuthService } from '../../services/auth.service';
import type { AttendancePunchResult } from '../../models/attendance';
import { AttendanceService } from '../../services/attendance.service';

@Component({
  selector: 'app-attendance-punch-page',
  templateUrl: './attendance-punch-page.component.html',
})
export class AttendancePunchPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly attendance = inject(AttendanceService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly result = signal<AttendancePunchResult | null>(null);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('t')?.trim() ?? '';
    if (!token) {
      this.error.set('ลิงก์ลงเวลาไม่ถูกต้อง กรุณาแสกน QR จากจุดลงเวลา');
      this.loading.set(false);
      return;
    }

    this.attendance
      .punch(token)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (payload) => {
          this.result.set(payload);
          this.loading.set(false);
        },
        error: (err: { error?: { error?: string } }) => {
          this.error.set(err.error?.error ?? 'ลงเวลาไม่สำเร็จ');
          this.loading.set(false);
        },
      });
  }

  goHome(): void {
    void this.router.navigate(this.auth.homeRouteSegments());
  }
}
