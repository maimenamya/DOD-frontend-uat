import {
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, map } from 'rxjs';
import QRCode from 'qrcode';

import { writeStoredShopPublicId } from '../../core/shop-public-id.storage';
import type { AttendanceKioskPayload } from '../../models/attendance';
import { AttendanceService } from '../../services/attendance.service';

@Component({
  selector: 'app-attendance-kiosk-page',
  templateUrl: './attendance-kiosk-page.component.html',
})
export class AttendanceKioskPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly attendance = inject(AttendanceService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly shopPublicId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('shopPublicId')?.trim() ?? '')),
    { initialValue: '' },
  );

  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly shopName = signal('');
  readonly branchCode = signal('');
  readonly qrDataUrl = signal<string | null>(null);
  readonly countdownSeconds = signal(0);
  readonly expiresAtLabel = signal('');

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((params) => params.get('shopPublicId')?.trim() ?? ''),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((publicId) => {
        if (!publicId) {
          this.error.set('ลิงก์จุดลงเวลาไม่ถูกต้อง');
          this.loading.set(false);
          return;
        }
        writeStoredShopPublicId(publicId);
        this.loadKiosk();
      });
  }

  private loadKiosk(): void {
    const publicId = this.shopPublicId();
    if (!publicId) return;

    this.loading.set(true);
    this.error.set(null);
    this.clearTimers();

    this.attendance
      .getKiosk(publicId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (payload) => {
          const urlPublicId = this.shopPublicId();
          if (urlPublicId && payload.shopPublicId !== urlPublicId) {
            this.error.set('รหัสร้านไม่ตรงกับลิงก์ — กรุณาเปิดจุดลงเวลาจากเมนูของสาขาที่ถูกต้อง');
            this.loading.set(false);
            return;
          }
          void this.applyKioskPayload(payload);
        },
        error: () => {
          this.error.set('โหลด QR ลงเวลาไม่สำเร็จ กรุณารีเฟรชหน้าจอ');
          this.loading.set(false);
        },
      });
  }

  private async applyKioskPayload(payload: AttendanceKioskPayload): Promise<void> {
    this.shopName.set(payload.shopName);
    this.branchCode.set(payload.branchCode);
    this.expiresAtLabel.set(payload.expiresAtLabel);
    this.countdownSeconds.set(payload.refreshInSeconds);

    const scanUrl = this.buildScanUrl(payload.shopPublicId, payload.token);
    try {
      const dataUrl = await QRCode.toDataURL(scanUrl, {
        width: 420,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' },
      });
      this.qrDataUrl.set(dataUrl);
    } catch {
      this.error.set('สร้าง QR ไม่สำเร็จ');
      this.loading.set(false);
      return;
    }

    this.loading.set(false);
    this.scheduleRefresh(payload.refreshInSeconds);
  }

  private buildScanUrl(shopPublicId: string, token: string): string {
    const origin = window.location.origin.replace(/\/+$/, '');
    const query = new URLSearchParams({ t: token });
    return `${origin}/s/${encodeURIComponent(shopPublicId)}/attendance/punch?${query.toString()}`;
  }

  private scheduleRefresh(refreshInSeconds: number): void {
    this.countdownSeconds.set(refreshInSeconds);
    this.countdownTimer = setInterval(() => {
      const next = this.countdownSeconds() - 1;
      if (next <= 0) {
        this.countdownSeconds.set(0);
        return;
      }
      this.countdownSeconds.set(next);
    }, 1000);

    this.refreshTimer = setTimeout(() => this.loadKiosk(), refreshInSeconds * 1000);
  }

  private clearTimers(): void {
    if (this.refreshTimer != null) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (this.countdownTimer != null) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }
}
