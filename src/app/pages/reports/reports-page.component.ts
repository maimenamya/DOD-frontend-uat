import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, finalize, of } from 'rxjs';

import { ShopDateInputComponent } from '../../components/shop-date-input/shop-date-input.component';
import { AuthService } from '../../services/auth.service';
import { ReportService } from '../../services/report.service';
import { ToastService } from '../../services/toast.service';
import type {
  ReportPreview,
  ReportPreviewParams,
  ReportSection,
} from '../../models/report';
import { shopCalendarTodayInput } from '../open-table/open-table-ledger.util';
import { blobApiErrorMessage } from '../../utils/excel-download.util';

const ALL_SECTIONS: ReportSection[] = [
  'bills',
  'drinks',
  'expenses',
  'sale_breakdown',
  'food',
  'stock',
];

function shopCalendarMonthStartInput(): string {
  const today = shopCalendarTodayInput();
  return `${today.slice(0, 8)}01`;
}

@Component({
  selector: 'app-reports-page',
  imports: [DecimalPipe, FormsModule, ShopDateInputComponent],
  templateUrl: './reports-page.component.html',
  styleUrl: './reports-page.component.css',
})
export class ReportsPageComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly reportService = inject(ReportService);
  private readonly toast = inject(ToastService);

  readonly rangeFrom = signal(shopCalendarMonthStartInput());
  readonly rangeTo = signal(shopCalendarTodayInput());

  readonly previewLoading = signal(false);
  readonly downloading = signal(false);

  readonly preview = signal<ReportPreview | null>(null);
  readonly error = signal<string | null>(null);

  readonly canDownload = computed(() => !this.previewLoading() && !this.downloading());

  private get shopId(): number | null {
    return this.auth.getShopId();
  }

  ngOnInit(): void {
    this.loadPreview();
  }

  applyRange(): void {
    if (this.rangeFrom() > this.rangeTo()) {
      this.toast.showError('ตั้งแต่วันที่ต้องไม่เกินวันถึง');
      return;
    }
    this.loadPreview();
  }

  private buildParams(): ReportPreviewParams | null {
    const shopId = this.shopId;
    if (shopId == null) return null;
    return {
      shopId,
      preset: 'custom',
      from: this.rangeFrom(),
      to: this.rangeTo(),
      sections: ALL_SECTIONS,
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
          this.error.set(msg ?? 'โหลดรายงานไม่สำเร็จ');
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

  formatMoney(value: number): string {
    return value.toLocaleString('th-TH');
  }

  drinkPeopleRows(preview: ReportPreview) {
    const staff = (preview.drinks?.staff ?? []).filter((row) => row.totalDrinks > 0);
    const entertainers = (preview.drinks?.entertainers ?? []).filter(
      (row) => row.totalDrinks > 0,
    );
    return [...staff, ...entertainers].sort((a, b) => b.totalDrinks - a.totalDrinks);
  }

  /** Card 8 — dish count only, one row per sale. */
  foodDishTotalsBySale(preview: ReportPreview): Array<{
    saleEmployeeId: string;
    saleNickname: string;
    quantity: number;
  }> {
    const map = new Map<string, { saleNickname: string; quantity: number }>();
    for (const row of preview.food?.bySale ?? []) {
      const existing = map.get(row.saleEmployeeId);
      if (existing) {
        existing.quantity += row.quantity;
      } else {
        map.set(row.saleEmployeeId, {
          saleNickname: row.saleNickname,
          quantity: row.quantity,
        });
      }
    }
    return [...map.entries()]
      .map(([saleEmployeeId, v]) => ({
        saleEmployeeId,
        saleNickname: v.saleNickname,
        quantity: v.quantity,
      }))
      .sort((a, b) => b.quantity - a.quantity || a.saleNickname.localeCompare(b.saleNickname, 'th'));
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
}
