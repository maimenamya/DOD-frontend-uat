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

    try {
      // Import first so the tap still counts as user gesture when getUserMedia runs.
      const { Html5Qrcode } = await import('html5-qrcode');
      await this.waitForQrReaderElement();

      this.scanner = new Html5Qrcode(QR_READER_ELEMENT_ID);
      const config = { fps: 8, qrbox: { width: 240, height: 240 } };
      const onSuccess = (decodedText: string): void => {
        void this.onQrDecoded(decodedText);
      };
      const onFailure = (): void => {
        // scan attempt — ignore
      };

      await this.startScannerWithFallback(this.scanner, Html5Qrcode, config, onSuccess, onFailure);
    } catch (error) {
      this.scanning.set(false);
      this.scanError.set(this.cameraErrorMessage(error));
      await this.disposeScanner();
    }
  }

  /** Android Chrome often needs the host div painted before Html5Qrcode.start. */
  private async waitForQrReaderElement(): Promise<void> {
    const deadline = Date.now() + 2500;
    while (Date.now() < deadline) {
      if (document.getElementById(QR_READER_ELEMENT_ID)) return;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    throw new Error('QR_READER_MISSING');
  }

  /**
   * Some Android devices reject facingMode=environment (OverconstrainedError)
   * or need an explicit cameraId from getCameras().
   */
  private async startScannerWithFallback(
    scanner: import('html5-qrcode').Html5Qrcode,
    Html5Qrcode: typeof import('html5-qrcode').Html5Qrcode,
    config: { fps: number; qrbox: { width: number; height: number } },
    onSuccess: (decodedText: string) => void,
    onFailure: () => void,
  ): Promise<void> {
    let lastError: unknown;

    const tryStart = async (
      cameraIdOrConfig: string | { facingMode: string },
    ): Promise<boolean> => {
      try {
        await scanner.start(cameraIdOrConfig, config, onSuccess, onFailure);
        return true;
      } catch (error) {
        lastError = error;
        try {
          if (scanner.isScanning) await scanner.stop();
        } catch {
          /* ignore */
        }
        const name =
          error && typeof error === 'object' && 'name' in error
            ? String((error as { name?: string }).name)
            : '';
        // User denied — do not keep prompting other cameras.
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          throw error;
        }
        return false;
      }
    };

    // 1) Prefer back camera via facingMode (keeps user-gesture close on Android).
    if (await tryStart({ facingMode: 'environment' })) return;

    // 2) Explicit device ids (labels often empty until permission was granted once).
    try {
      const cameras = await Html5Qrcode.getCameras();
      const ordered = [...cameras].sort((a, b) => {
        const score = (label: string): number =>
          /back|rear|environment|หลัง|ท้าย/i.test(label) ? 0 : 1;
        return score(a.label) - score(b.label);
      });
      // On many Androids the last camera is the rear lens when labels are blank.
      if (ordered.length > 1 && !ordered.some((c) => /back|rear|environment/i.test(c.label))) {
        ordered.reverse();
      }
      for (const cam of ordered) {
        if (cam.id && (await tryStart(cam.id))) return;
      }
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'name' in error &&
        ((error as { name?: string }).name === 'NotAllowedError' ||
          (error as { name?: string }).name === 'SecurityError')
      ) {
        throw error;
      }
      // ignore enumerate failure
    }

    // 3) Front camera last.
    if (await tryStart({ facingMode: 'user' })) return;

    throw lastError ?? new Error('CAMERA_START_FAILED');
  }

  private cameraErrorMessage(error: unknown): string {
    const name =
      error && typeof error === 'object' && 'name' in error
        ? String((error as { name?: string }).name)
        : '';
    const message =
      error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: string }).message)
        : String(error ?? '');

    if (message === 'QR_READER_MISSING') {
      return 'เปิดกล้องไม่สำเร็จ — ลองกดแสกนอีกครั้ง';
    }
    if (name === 'NotAllowedError' || /Permission|NotAllowed/i.test(message)) {
      return (
        'ไม่อนุญาตกล้อง — เปิดที่ตั้งค่า → แอป (Chrome) → สิทธิ์กล้อง → อนุญาต ' +
        'แล้วรีเฟรชหน้านี้'
      );
    }
    if (name === 'NotFoundError' || /Requested device not found/i.test(message)) {
      return 'ไม่พบกล้องบนเครื่องนี้ — ใช้แอปแสกน QR แล้วเปิดลิงก์ลงเวลาแทน';
    }
    if (name === 'NotReadableError' || /Could not start video|in use/i.test(message)) {
      return 'กล้องถูกแอปอื่นใช้อยู่ — ปิดแอปกล้อง/วิดีโอคอล แล้วลองใหม่';
    }
    if (name === 'OverconstrainedError' || /Overconstrained/i.test(message)) {
      return 'เครื่องนี้เลือกกล้องหลังไม่ได้ — ลองกดแสกนอีกครั้ง หรืออนุญาตกล้องใน Chrome';
    }
    if (name === 'SecurityError' || !window.isSecureContext) {
      return 'ต้องเปิดผ่าน HTTPS ถึงจะใช้กล้องได้';
    }
    return 'เปิดกล้องไม่ได้ — อนุญาตกล้องใน Chrome หรือใช้แอปแสกน QR แทน';
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
          const tagNote =
            result.prTagWorkDayRecorded ? ' · บันทึกวันทำงานแท็กแล้ว' : '';
          this.toast.showSuccess(
            `${result.punchTypeLabel} — ${result.punchedAtLabel} น.${tagNote}`,
          );
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
