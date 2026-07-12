import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';

import { AppModalComponent } from '../../components/app-modal/app-modal.component';
import { ListPaginatorComponent } from '../../components/list-paginator/list-paginator.component';
import { MasterListToolbarComponent } from '../../components/master-list-toolbar/master-list-toolbar.component';
import { ShopDateInputComponent } from '../../components/shop-date-input/shop-date-input.component';
import type { BillHistoryListResponse, BillHistoryRow } from '../../models/bill-history';
import type { BillReceiptPayload } from '../../models/bill-receipt';
import { BillHistoryService } from '../../services/bill-history.service';
import { BillReceiptService } from '../../services/bill-receipt.service';
import { ToastService } from '../../services/toast.service';
import {
  MasterListQueryState,
  createMasterListView,
  masterListRowNumber,
} from '../../utils/master-list.util';
import { shopCalendarTodayInput } from '../open-table/open-table-ledger.util';

function shopCalendarMonthStartInput(): string {
  const today = shopCalendarTodayInput();
  return `${today.slice(0, 8)}01`;
}

@Component({
  selector: 'app-bill-history-page',
  imports: [
    DecimalPipe,
    FormsModule,
    ShopDateInputComponent,
    AppModalComponent,
    MasterListToolbarComponent,
    ListPaginatorComponent,
  ],
  templateUrl: './bill-history-page.component.html',
  styleUrl: './bill-history-page.component.css',
})
export class BillHistoryPageComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly billHistoryService = inject(BillHistoryService);
  private readonly billReceiptService = inject(BillReceiptService);
  private readonly toast = inject(ToastService);

  readonly rangeFrom = signal(shopCalendarMonthStartInput());
  readonly rangeTo = signal(shopCalendarTodayInput());
  readonly loading = signal(true);
  readonly receiptLoading = signal(false);
  readonly printing = signal(false);

  readonly payload = signal<BillHistoryListResponse | null>(null);
  readonly selectedRow = signal<BillHistoryRow | null>(null);
  readonly receipt = signal<BillReceiptPayload | null>(null);

  readonly items = computed(() => this.payload()?.items ?? []);
  readonly listQuery = new MasterListQueryState();
  readonly listView = createMasterListView(this.items, this.listQuery, (row) =>
    [
      row.billReference,
      row.businessDateLabel,
      row.checkedOutLabel,
      row.dineInLabel ?? '',
      row.saleNickname,
      row.paymentMethodLabel,
      String(row.billAmount),
    ].join(' '),
  );
  readonly masterListRowNumber = masterListRowNumber;

  readonly hasItems = computed(() => this.items().length > 0);
  readonly totalAmount = computed(() => this.payload()?.totalAmount ?? 0);
  readonly billCount = computed(() => this.payload()?.billCount ?? 0);
  readonly rangeLabelFrom = computed(() => this.payload()?.fromDate ?? '');
  readonly rangeLabelTo = computed(() => this.payload()?.toDate ?? '');
  readonly selfOnly = computed(() => this.payload()?.selfOnly ?? false);

  ngOnInit(): void {
    this.loadList();
  }

  onRangeFromChange(value: string): void {
    this.rangeFrom.set(value);
    this.reloadIfRangeValid();
  }

  onRangeToChange(value: string): void {
    this.rangeTo.set(value);
    this.reloadIfRangeValid();
  }

  applyRange(): void {
    if (this.rangeFrom() > this.rangeTo()) {
      this.toast.showError('ตั้งแต่วันที่ต้องไม่เกินวันถึง');
      return;
    }
    this.loadList();
  }

  openDetail(row: BillHistoryRow): void {
    if (!row.hasReceipt) {
      this.toast.showError('บิลนี้ไม่มีรายละเอียดเก็บไว้ (บิลแบบอื่น)');
      return;
    }
    this.selectedRow.set(row);
    this.receipt.set(null);
    this.receiptLoading.set(true);
    this.billReceiptService
      .getBillReceipt(row.id, { dispatchPrint: false })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.receiptLoading.set(false)),
      )
      .subscribe({
        next: (response) => this.receipt.set(response.receipt),
        error: (err: HttpErrorResponse) => {
          this.selectedRow.set(null);
          this.toast.showError(this.apiError(err, 'โหลดรายละเอียดบิลไม่สำเร็จ'));
        },
      });
  }

  closeDetail(): void {
    this.selectedRow.set(null);
    this.receipt.set(null);
  }

  printSelected(): void {
    const row = this.selectedRow();
    const cached = this.receipt();
    if (!row?.hasReceipt) return;

    if (cached) {
      this.runPrint(cached);
      return;
    }

    this.printing.set(true);
    const printFrame = this.billReceiptService.createPrintFrame();
    this.billReceiptService
      .getBillReceipt(row.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.printing.set(false)),
      )
      .subscribe({
        next: (response) => {
          this.receipt.set(response.receipt);
          this.runPrint(response.receipt, printFrame);
        },
        error: (err: HttpErrorResponse) => {
          this.billReceiptService.removePrintFrame(printFrame);
          this.toast.showError(this.apiError(err, 'พิมพ์บิลไม่สำเร็จ'));
        },
      });
  }

  private runPrint(
    receipt: BillReceiptPayload,
    printFrame?: HTMLIFrameElement | null,
  ): void {
    const outcome = this.billReceiptService.printReceipt(receipt, { printFrame });
    if (!outcome.ok && outcome.message) {
      this.toast.showError(outcome.message);
    }
  }

  private reloadIfRangeValid(): void {
    const from = this.rangeFrom().trim();
    const to = this.rangeTo().trim();
    if (!from || !to) return;
    if (from > to) {
      this.toast.showError('ตั้งแต่วันที่ต้องไม่เกินวันถึง');
      return;
    }
    this.loadList();
  }

  private loadList(): void {
    if (this.rangeFrom() > this.rangeTo()) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.listQuery.resetPage();
    this.billHistoryService
      .list({ from: this.rangeFrom(), to: this.rangeTo() })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (response) => this.payload.set(response),
        error: (err: HttpErrorResponse) => {
          this.payload.set(null);
          this.toast.showError(this.apiError(err, 'โหลดบิลย้อนหลังไม่สำเร็จ'));
        },
      });
  }

  private apiError(err: HttpErrorResponse, fallback: string): string {
    const message = err.error?.error;
    return typeof message === 'string' && message.trim() ? message : fallback;
  }
}
