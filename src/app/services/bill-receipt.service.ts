import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';
import type { BillReceiptResponse } from '../models/bill-receipt';
import type { ReceiptPrintChannel } from '../models/shop-receipt-printer';
import { detectReceiptPrintPlatform } from '../utils/receipt-print-platform.util';

export type ReceiptPrintOutcome = {
  ok: boolean;
  method: 'browser' | 'rawbt' | 'none';
  message?: string;
};

export type PrintReceiptOptions = {
  /** Open with openPrintWindow() on the same user click — Chrome needs this before async API. */
  printWindow?: Window | null;
};

const RAWBT_PACKAGE = 'ru.a402d.rawbtprinter';

@Injectable({ providedIn: 'root' })
export class BillReceiptService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  getBillReceipt(billId: number): Observable<BillReceiptResponse> {
    return this.http.get<BillReceiptResponse>(
      this.api.resource('open-table', 'bills', String(billId), 'receipt'),
    );
  }

  /**
   * Call synchronously on button click (before HTTP) so Chrome allows print after API returns.
   */
  openPrintWindow(): Window | null {
    try {
      const win = window.open('', '_blank', 'noopener,noreferrer,width=420,height=720');
      if (!win) return null;
      win.document.open();
      win.document.write(`<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <title>ใบเสร็จ</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 24px; text-align: center; color: #333; }
  </style>
</head>
<body><p>กำลังโหลดใบเสร็จ…</p></body>
</html>`);
      win.document.close();
      return win;
    } catch {
      return null;
    }
  }

  closePrintWindow(printWindow?: Window | null): void {
    try {
      printWindow?.close();
    } catch {
      // ignore
    }
  }

  shouldOpenPrintWindowOnDesktop(channel?: ReceiptPrintChannel): boolean {
    if (channel === 'off') return false;
    if (detectReceiptPrintPlatform() !== 'desktop') return false;
    if (channel === 'bridging_app') return false;
    return true;
  }

  /**
   * Print using the shop's configured channel (from receipt.printChannel).
   */
  printReceipt(
    receipt: BillReceiptResponse['receipt'],
    options?: PrintReceiptOptions,
  ): ReceiptPrintOutcome {
    return this.printReceiptWithChannel(receipt, receipt.printChannel ?? 'auto', options);
  }

  printReceiptWithChannel(
    receipt: BillReceiptResponse['receipt'],
    channel: ReceiptPrintChannel,
    options?: PrintReceiptOptions,
  ): ReceiptPrintOutcome {
    if (channel === 'off') {
      this.closePrintWindow(options?.printWindow);
      return {
        ok: true,
        method: 'none',
        message: 'ปิดการพิมพ์อัตโนมัติ — ตั้งค่าที่เมนู เครื่องพิมพ์ใบเสร็จ',
      };
    }
    if (channel === 'browser_pdf') {
      return this.browserPrintOutcome(receipt, options?.printWindow);
    }
    if (channel === 'bridging_app') {
      this.closePrintWindow(options?.printWindow);
      return this.printViaBridgingApp(receipt, this.detectBridgingPlatform());
    }
    if (channel === 'wifi_raw') {
      const bridged = this.printViaBridgingApp(receipt, this.detectBridgingPlatform());
      if (bridged.ok) {
        this.closePrintWindow(options?.printWindow);
        return bridged;
      }
      return this.browserPrintOutcome(receipt, options?.printWindow);
    }

    // auto — PC browser, phone/tablet bridging app
    const platform = detectReceiptPrintPlatform();
    if (platform === 'desktop') {
      return this.browserPrintOutcome(receipt, options?.printWindow);
    }
    this.closePrintWindow(options?.printWindow);
    return this.printViaBridgingApp(receipt, platform);
  }

  private browserPrintOutcome(
    receipt: BillReceiptResponse['receipt'],
    printWindow?: Window | null,
  ): ReceiptPrintOutcome {
    const ok = this.printBrowserReceipt(receipt, printWindow);
    if (!ok) {
      return {
        ok: false,
        method: 'browser',
        message:
          'เปิดหน้าพิมพ์ไม่ได้ — อนุญาตป็อปอัปจากเว็บนี้ แล้วกดพิมพ์ใบเสร็จอีกครั้ง',
      };
    }
    return { ok: true, method: 'browser' };
  }

  private detectBridgingPlatform(): 'android' | 'ios' {
    return detectReceiptPrintPlatform() === 'ios' ? 'ios' : 'android';
  }

  /**
   * Desktop → Chrome print dialog (USB printer).
   * Android → RawBT intent + rawbt:base64 (ESC/POS raster).
   * iOS → rawbt:base64 via bridging app (TSP-Print / แอปที่รองรับ URL scheme).
   */
  printViaBridgingApp(
    receipt: BillReceiptResponse['receipt'],
    platform: 'android' | 'ios',
  ): ReceiptPrintOutcome {
    const base64 = receipt.escPosBase64.replace(/\s/g, '');
    if (!base64) {
      return { ok: false, method: 'rawbt', message: 'ไม่มีข้อมูลใบเสร็จสำหรับพิมพ์' };
    }

    if (platform === 'android') {
      const intentUrl = `intent:base64,${base64}#Intent;scheme=rawbt;package=${RAWBT_PACKAGE};end;`;
      if (this.navigatePrintUrl(intentUrl)) {
        return { ok: true, method: 'rawbt' };
      }
    }

    const rawbtUrl = `rawbt:base64,${base64}`;
    if (this.navigatePrintUrl(rawbtUrl)) {
      return { ok: true, method: 'rawbt' };
    }

    return {
      ok: false,
      method: 'rawbt',
      message:
        platform === 'ios'
          ? 'ส่งไปแอปพิมพ์ไม่ได้ — ติดตั้งแอปตัวกลาง (เช่น TSP-Print) แล้วจับคู่ BT'
          : 'ส่งไป RawBT ไม่ได้ — ติดตั้งแอป RawBT แล้วจับคู่เครื่องปริ้น',
    };
  }

  /** @deprecated use printViaBridgingApp */
  printViaRawBt(receipt: BillReceiptResponse['receipt']): ReceiptPrintOutcome {
    return this.printViaBridgingApp(receipt, 'android');
  }

  private navigatePrintUrl(url: string): boolean {
    try {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Print from the shop PC browser (USB / Bluetooth thermal).
   * Pass printWindow from openPrintWindow() when calling after async HTTP.
   */
  printBrowserReceipt(
    receipt: BillReceiptResponse['receipt'],
    printWindow?: Window | null,
  ): boolean {
    const built = this.buildReceiptPrintDocument(receipt);
    const targetWindow = printWindow ?? this.openPrintWindow();
    if (!targetWindow) {
      return false;
    }

    try {
      targetWindow.document.open();
      targetWindow.document.write(built.html);
      targetWindow.document.close();
    } catch {
      if (!printWindow) targetWindow.close();
      return false;
    }

    this.triggerPrintWhenReady(targetWindow);
    return true;
  }

  private buildReceiptPrintDocument(receipt: BillReceiptResponse['receipt']): {
    html: string;
  } {
    const widthMm = receipt.paperWidthMm >= 80 ? 80 : 58;
    const title = escapeHtml(receipt.billReference);
    const shopTitle = escapeHtml(receipt.shopName.trim() || 'บิล');
    const headerBlock = receipt.headerText?.trim()
      ? `<div class="center">${escapeHtml(receipt.headerText.trim())}</div>`
      : '';
    const footerBlock = receipt.footerText?.trim()
      ? `<div class="center footer">${escapeHtml(receipt.footerText.trim())}</div>`
      : '';

    const itemRows = receipt.lines
      .map((line) => {
        const name = escapeHtml(truncateReceiptName(line.name, 18));
        const qty = escapeHtml(String(line.quantity));
        const amount = escapeHtml(formatReceiptMoney(line.lineTotal));
        return `<div class="item-row"><span class="item-name">${name}</span><span class="item-qty">${qty}</span><span class="item-amt">${amount}</span></div>`;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <title>ใบเสร็จ ${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet" />
  <style>
    @page { margin: 2mm; size: ${widthMm}mm auto; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Sarabun', 'Tahoma', sans-serif;
      font-size: 11px;
      line-height: 1.35;
      margin: 0;
      padding: 3mm 2mm;
      color: #000;
      width: ${widthMm - 4}mm;
    }
    .shop-title { font-size: 15px; font-weight: 700; text-align: center; margin-bottom: 2px; }
    .bill-title { font-size: 15px; font-weight: 700; text-align: center; margin: 4px 0 8px; }
    .center { text-align: center; margin: 2px 0; }
    .footer { margin-top: 8px; }
    .row {
      display: flex;
      justify-content: space-between;
      gap: 4px;
      margin: 2px 0;
    }
    .row > span:first-child { flex-shrink: 0; }
    .row > span:last-child { text-align: right; word-break: break-word; }
    .dash {
      border: none;
      border-top: 1px dashed #000;
      margin: 6px 0;
    }
    .items-header, .item-row {
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: 4px 6px;
      align-items: baseline;
    }
    .items-header { font-weight: 700; margin-bottom: 2px; }
    .item-name { word-break: break-word; }
    .item-qty, .item-amt { text-align: right; white-space: nowrap; }
    .grand {
      display: flex;
      justify-content: space-between;
      font-size: 16px;
      font-weight: 700;
      margin: 6px 0;
    }
    .powered { text-align: center; margin-top: 10px; font-size: 10px; }
  </style>
</head>
<body>
  <div class="shop-title">${shopTitle}</div>
  ${headerBlock}
  <div class="bill-title">บิล</div>
  <div class="row"><span>ทานที่ร้าน</span><span>${escapeHtml(receipt.dineInLabel)}</span></div>
  <div class="row"><span>ชื่อพนักงาน</span><span>${escapeHtml(receipt.staffLabel)}</span></div>
  <div class="row"><span>เวลาเข้า</span><span>${escapeHtml(receipt.checkedInLabel)}</span></div>
  <div class="row"><span>เวลาที่พิมพ์</span><span>${escapeHtml(receipt.printedAtLabel)}</span></div>
  <hr class="dash" />
  <div class="items-header">
    <span>สินค้า</span><span>Qty</span><span>ราคารวม</span>
  </div>
  ${itemRows}
  <hr class="dash" />
  <div class="row">
    <span>ยอดรวม</span>
    <span>${escapeHtml(String(receipt.totalQuantity))}  ${escapeHtml(formatReceiptMoney(receipt.grandTotal))}</span>
  </div>
  <hr class="dash" />
  <div class="grand">
    <span>ทั้งหมด</span>
    <span>฿${escapeHtml(formatReceiptMoney(receipt.grandTotal))}</span>
  </div>
  ${footerBlock}
  <div class="powered">Powered by DOD</div>
</body>
</html>`;
    return { html };
  }

  private triggerPrintWhenReady(targetWindow: Window): void {
    const frameDoc = targetWindow.document;
    let printed = false;

    const triggerPrint = () => {
      if (printed) return;
      printed = true;
      const run = async () => {
        try {
          await frameDoc.fonts?.ready;
        } catch {
          // ignore
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
        targetWindow.focus();
        targetWindow.print();
      };
      void run();
    };

    const img = frameDoc.querySelector('img');
    if (img) {
      if (img.complete) {
        requestAnimationFrame(() => triggerPrint());
      } else {
        img.addEventListener('load', () => triggerPrint(), { once: true });
        img.addEventListener('error', () => triggerPrint(), { once: true });
        setTimeout(triggerPrint, 3000);
      }
      return;
    }

    if (frameDoc.fonts?.status === 'loaded') {
      triggerPrint();
      return;
    }
    frameDoc.fonts?.addEventListener('loadingdone', () => triggerPrint(), { once: true });
    targetWindow.addEventListener('load', () => triggerPrint(), { once: true });
    setTimeout(triggerPrint, 2000);
  }

  /** Download ESC/POS bytes for testing with USB/BT print tools. */
  downloadEscPos(receipt: BillReceiptResponse['receipt']): void {
    const binary = atob(receipt.escPosBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `receipt-${receipt.billReference}.bin`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatReceiptMoney(amount: number): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function truncateReceiptName(name: string, maxChars: number): string {
  if (name.length <= maxChars) return name;
  return `${name.slice(0, Math.max(1, maxChars - 1))}…`;
}
