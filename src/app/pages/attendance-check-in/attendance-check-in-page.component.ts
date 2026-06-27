import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import type {
  AttendanceEmployeeMonthPayload,
  AttendanceMePayload,
  AttendancePunchResult,
} from '../../models/attendance';
import { AttendanceService } from '../../services/attendance.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { parseAttendanceMonthValue } from '../../utils/attendance-month.util';
import { parseAttendancePunchTokenFromQr } from '../../utils/attendance-qr-scan.util';
import { shopCalendarTodayInput } from '../open-table/open-table-ledger.util';
import { AttendanceMonthPickerComponent } from '../../components/attendance-month-picker/attendance-month-picker.component';
import { AttendanceMonthShiftsPanelComponent } from '../../components/attendance-month-shifts-panel/attendance-month-shifts-panel.component';

const QR_READER_ELEMENT_ID = 'attendance-qr-reader';

@Component({
  selector: 'app-attendance-check-in-page',
  imports: [AttendanceMonthPickerComponent, AttendanceMonthShiftsPanelComponent],
  templateUrl: './attendance-check-in-page.component.html',
  styleUrl: './attendance-check-in-page.component.css',
})
export class AttendanceCheckInPageComponent implements OnInit {
  private readonly attendance = inject(AttendanceService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  private scanner: import('html5-qrcode').Html5Qrcode | null = null;
  private scanHandled = false;

  readonly loading = signal(true);
  readonly payload = signal<AttendanceMePayload | null>(null);
  readonly scanning = signal(false);
  readonly punching = signal(false);
  readonly scanError = signal<string | null>(null);
  readonly lastPunch = signal<AttendancePunchResult | null>(null);
  readonly monthValue = signal(shopCalendarTodayInput().slice(0, 7));
  readonly monthLoading = signal(false);
  readonly monthPayload = signal<AttendanceEmployeeMonthPayload | null>(null);

  readonly nextPunchLabel = computed(() => {
    const status = this.payload()?.attendanceStatus;
    if (!status) return null;
    return status === 'OFF_DUTY' ? 'เข้างาน' : 'ออกงาน';
  });

  readonly employeeNickname = computed(() => this.auth.getUser()?.nickname?.trim() ?? '');

  constructor() {
    this.destroyRef.onDestroy(() => {
      void this.stopScan();
    });
  }

  ngOnInit(): void {
    this.reload();
    this.loadMyMonth();
  }

  onMonthChange(value: string): void {
    this.monthValue.set(value);
    this.loadMyMonth();
  }

  private loadMyMonth(): void {
    const parsed = parseAttendanceMonthValue(this.monthValue());
    if (!parsed) return;

    this.monthLoading.set(true);
    this.monthPayload.set(null);
    this.attendance.getMyMonth(parsed.year, parsed.month).subscribe({
      next: (payload) => {
        this.monthPayload.set(payload);
        this.monthLoading.set(false);
      },
      error: () => {
        this.toast.showError('โหลดบันทึกเวลาไม่สำเร็จ');
        this.monthLoading.set(false);
      },
    });
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

  async startScan(): Promise<void> {
    if (this.scanning() || this.punching()) return;

    this.scanError.set(null);
    this.lastPunch.set(null);
    this.scanHandled = false;
    this.scanning.set(true);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      this.scanner = new Html5Qrcode(QR_READER_ELEMENT_ID);
      await this.scanner.start(
        { facingMode: 'environment' },
        { fps: 8, qrbox: { width: 260, height: 260 } },
        (decodedText) => {
          void this.onQrDecoded(decodedText);
        },
        () => {
          // scan attempt — ignore
        },
      );
    } catch {
      this.scanning.set(false);
      this.scanError.set(
        'เปิดกล้องไม่ได้ — อนุญาตการใช้กล้องในเบราว์เซอร์ หรือใช้แอปแสกน QR แทน',
      );
      await this.disposeScanner();
    }
  }

  async stopScan(): Promise<void> {
    this.scanning.set(false);
    await this.disposeScanner();
  }

  private async onQrDecoded(decodedText: string): Promise<void> {
    if (this.scanHandled || this.punching()) return;

    const token = parseAttendancePunchTokenFromQr(decodedText);
    if (!token) {
      this.scanError.set('QR ไม่ใช่รหัสลงเวลา — ชี้ไปที่ QR บนจอจุดลงเวลา');
      return;
    }

    this.scanHandled = true;
    this.punching.set(true);
    this.scanError.set(null);
    await this.stopScan();

    this.attendance
      .punch(token)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.lastPunch.set(result);
          this.punching.set(false);
          this.toast.showSuccess(`${result.punchTypeLabel} — ${result.punchedAtLabel} น.`);
          this.reload();
          this.loadMyMonth();
        },
        error: (err: { error?: { error?: string } }) => {
          this.punching.set(false);
          this.scanHandled = false;
          const message = err.error?.error ?? 'ลงเวลาไม่สำเร็จ';
          this.scanError.set(message);
          this.toast.showError(message);
        },
      });
  }

  private async disposeScanner(): Promise<void> {
    const scanner = this.scanner;
    this.scanner = null;
    if (!scanner) return;

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
      scanner.clear();
    } catch {
      // camera may already be released
    }
  }
}
