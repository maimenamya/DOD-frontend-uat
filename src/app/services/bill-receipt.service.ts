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
      built.revoke?.();
      return false;
    }

    try {
      targetWindow.document.open();
      targetWindow.document.write(built.html);
      targetWindow.document.close();
    } catch {
      built.revoke?.();
      if (!printWindow) targetWindow.close();
      return false;
    }

    this.triggerPrintWhenReady(targetWindow, built.revoke);
    return true;
  }

  private buildReceiptPrintDocument(receipt: BillReceiptResponse['receipt']): {
    html: string;
    revoke?: () => void;
  } {
    const widthMm = receipt.paperWidthMm >= 80 ? 80 : 58;
    const title = escapeHtml(receipt.billReference);

    if (receipt.receiptPngBase64) {
      const binary = atob(receipt.receiptPngBase64.replace(/\s/g, ''));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blobUrl = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
      const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <title>ใบเสร็จ ${title}</title>
  <style>
    @page { margin: 0; size: ${widthMm}mm auto; }
    body { margin: 0; padding: 0; }
    img { display: block; width: ${widthMm}mm; height: auto; }
  </style>
</head>
<body>
  <img src="${blobUrl}" alt="ใบเสร็จ" />
</body>
</html>`;
      return { html, revoke: () => URL.revokeObjectURL(blobUrl) };
    }

    const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <title>ใบเสร็จ ${title}</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" />
  <style>
    @page { margin: 2mm; size: ${widthMm}mm auto; }
    body {
      font-family: 'Sarabun', 'Tahoma', sans-serif;
      font-size: 12px;
      margin: 0;
      padding: 4px;
      color: #000;
      width: ${widthMm - 4}mm;
    }
    .line { white-space: pre-wrap; font-size: 11px; line-height: 1.35; }
    .grand {
      font-size: 18px;
      font-weight: 700;
      margin: 6px 0;
    }
  </style>
</head>
<body>
  ${receipt.textLines
    .map((line) => {
      if (line.includes('ทั้งหมด')) {
        return `<div class="grand line">${escapeHtml(line)}</div>`;
      }
      return `<div class="line">${escapeHtml(line)}</div>`;
    })
    .join('')}
</body>
</html>`;
    return { html };
  }

  private triggerPrintWhenReady(targetWindow: Window, revoke?: () => void): void {
    const frameDoc = targetWindow.document;
    let printed = false;

    const cleanup = () => {
      revoke?.();
    };

    const triggerPrint = () => {
      if (printed) return;
      printed = true;
      try {
        targetWindow.focus();
        targetWindow.print();
      } finally {
        setTimeout(cleanup, 1000);
      }
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

    targetWindow.onload = () => triggerPrint();
    setTimeout(triggerPrint, 500);
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
