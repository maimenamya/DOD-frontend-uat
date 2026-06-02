import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, finalize, of } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { ReportService } from '../../services/report.service';
import { ToastService } from '../../services/toast.service';
import type { ReportPreview, ReportPreviewParams, ReportSection } from '../../models/report';
import { shopCalendarTodayInput } from '../open-table/open-table-ledger.util';
import { blobApiErrorMessage } from '../../utils/excel-download.util';

const SECTION_OPTIONS: { id: ReportSection; label: string }[] = [
  { id: 'bills', label: 'ยอดบิล' },
  { id: 'drinks', label: 'บอร์ดเครื่องดื่ม' },
  { id: 'expenses', label: 'รายจ่าย' },
];

function shopCalendarMonthStartInput(): string {
  const today = shopCalendarTodayInput();
  return `${today.slice(0, 8)}01`;
}

@Component({
  selector: 'app-reports-page',
  imports: [DecimalPipe, FormsModule],
  templateUrl: './reports-page.component.html',
  styleUrl: './reports-page.component.css',
})
export class ReportsPageComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly reportService = inject(ReportService);
  private readonly toast = inject(ToastService);

  readonly sectionOptions = SECTION_OPTIONS;

  readonly rangeFrom = signal(shopCalendarMonthStartInput());
  readonly rangeTo = signal(shopCalendarTodayInput());
  readonly selectedSections = signal<ReportSection[]>(['bills', 'drinks']);

  readonly metaLoading = signal(true);
  readonly previewLoading = signal(false);
  readonly sending = signal(false);
  readonly downloading = signal(false);

  readonly ownerLineMasked = signal<string | null>(null);
  readonly ownerLineUserIdMissing = signal(false);
  readonly lineConfigured = signal(true);

  readonly preview = signal<ReportPreview | null>(null);
  readonly error = signal<string | null>(null);

  readonly canSend = computed(() => {
    if (this.ownerLineUserIdMissing() || !this.lineConfigured()) return false;
    if (this.sending() || this.previewLoading() || this.downloading()) return false;
    return this.selectedSections().length > 0;
  });

  readonly canDownload = computed(() => {
    if (this.previewLoading() || this.downloading() || this.sending()) return false;
    return this.selectedSections().length > 0;
  });

  private get shopId(): number | null {
    return this.auth.getShopId();
  }

  ngOnInit(): void {
    this.loadMeta();
    this.loadPreview();
  }

  applyRange(): void {
    if (this.rangeFrom() > this.rangeTo()) {
      this.toast.showError('ตั้งแต่วันที่ต้องไม่เกินวันถึง');
      return;
    }
    this.loadPreview();
  }

  onSectionChange(section: ReportSection, checked: boolean): void {
    this.selectedSections.update((current) => {
      if (checked) {
        return current.includes(section) ? current : [...current, section];
      }
      const next = current.filter((s) => s !== section);
      return next.length > 0 ? next : current;
    });
    this.loadPreview();
  }

  isSectionSelected(section: ReportSection): boolean {
    return this.selectedSections().includes(section);
  }

  private buildParams(): ReportPreviewParams | null {
    const shopId = this.shopId;
    if (shopId == null) return null;
    return {
      shopId,
      preset: 'custom',
      from: this.rangeFrom(),
      to: this.rangeTo(),
      sections: this.selectedSections(),
    };
  }

  loadPreview(): void {
    const params = this.buildParams();
    if (!params) {
      this.error.set('ไม่พบร้านในเซสชัน');
      return;
    }

    if (params.from! > params.to!) {
      this.error.set('ตั้งแต่วันที่ต้องไม่เกินวันถึง');
      return;
    }

    this.previewLoading.set(true);
    this.error.set(null);

    this.reportService
      .getPreview(params)
      .pipe(
        catchError((err: HttpErrorResponse) => {
          const msg = (err.error as { error?: string } | undefined)?.error;
          this.error.set(msg ?? 'โหลดตัวอย่างรายงานไม่สำเร็จ');
          this.preview.set(null);
          return of(null);
        }),
        finalize(() => this.previewLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((data) => {
        if (data) this.preview.set(data);
      });
  }

  downloadReport(): void {
    const params = this.buildParams();
    if (!params || !this.canDownload()) return;

    this.downloading.set(true);

    this.reportService
      .downloadExcel(params)
      .pipe(
        catchError((err: HttpErrorResponse) => {
          void this.readDownloadError(err, 'ดาวน์โหลด Excel ไม่สำเร็จ').then((msg) =>
            this.toast.showError(msg),
          );
          return of(null);
        }),
        finalize(() => this.downloading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((file) => {
        if (!file) return;
        const url = URL.createObjectURL(file.blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = file.filename;
        anchor.click();
        URL.revokeObjectURL(url);
        this.toast.showSuccess('ดาวน์โหลด Excel แล้ว — เปิดด้วย Microsoft Excel');
      });
  }

  sendReport(): void {
    const params = this.buildParams();
    if (!params) return;
    if (!this.canSend()) {
      if (this.ownerLineUserIdMissing()) {
        this.toast.showError('ยังไม่มี LINE User ID ของเจ้าของร้าน — ให้ OWNER กรอกในโปรไฟล์');
      } else if (!this.lineConfigured()) {
        this.toast.showError('เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า LINE');
      }
      return;
    }

    this.sending.set(true);
    this.reportService
      .sendLine(params)
      .pipe(
        catchError((err: HttpErrorResponse) => {
          this.toast.showError(this.readApiError(err, 'ส่ง LINE ไม่สำเร็จ'));
          return of(null);
        }),
        finalize(() => this.sending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (!result) return;
        this.toast.showSuccess(`ส่งสรุปรายงานทาง LINE ถึง ${result.sentTo} แล้ว`);
      });
  }

  formatMoney(value: number): string {
    return value.toLocaleString('th-TH');
  }

  private readApiError(err: HttpErrorResponse, fallback: string): string {
    const body = err.error as { error?: string } | undefined;
    return body?.error ?? fallback;
  }

  private async readDownloadError(err: HttpErrorResponse, fallback: string): Promise<string> {
    if (err.error instanceof Blob) {
      return blobApiErrorMessage(err.error, fallback);
    }
    return this.readApiError(err, fallback);
  }

  private loadMeta(): void {
    const shopId = this.shopId;
    if (shopId == null) {
      this.metaLoading.set(false);
      return;
    }

    this.reportService
      .getMeta(shopId)
      .pipe(
        catchError(() =>
          of({
            owner: null,
            ownerLineUserIdMissing: true,
            lineConfigured: false,
          }),
        ),
        finalize(() => this.metaLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((meta) => {
        this.ownerLineUserIdMissing.set(meta.ownerLineUserIdMissing);
        this.lineConfigured.set(meta.lineConfigured);
        this.ownerLineMasked.set(meta.owner?.lineUserIdMasked ?? null);
      });
  }
}
