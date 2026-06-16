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
   * Print using the shop's configured channel (from receipt.printChannel).
   */
  printReceipt(receipt: BillReceiptResponse['receipt']): ReceiptPrintOutcome {
    return this.printReceiptWithChannel(receipt, receipt.printChannel ?? 'auto');
  }

  printReceiptWithChannel(
    receipt: BillReceiptResponse['receipt'],
    channel: ReceiptPrintChannel,
  ): ReceiptPrintOutcome {
    if (channel === 'off') {
      return { ok: true, method: 'none' };
    }
    if (channel === 'browser_pdf') {
      return { ok: this.printBrowserReceipt(receipt), method: 'browser' };
    }
    if (channel === 'bridging_app') {
      return this.printViaBridgingApp(receipt, this.detectBridgingPlatform());
    }
    if (channel === 'wifi_raw') {
      const bridged = this.printViaBridgingApp(receipt, this.detectBridgingPlatform());
      if (bridged.ok) return bridged;
      return { ok: this.printBrowserReceipt(receipt), method: 'browser' };
    }

    // auto — PC browser, phone/tablet bridging app
    const platform = detectReceiptPrintPlatform();
    if (platform === 'desktop') {
      return { ok: this.printBrowserReceipt(receipt), method: 'browser' };
    }
    return this.printViaBridgingApp(receipt, platform);
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
   * Cloud API (Railway) cannot reach local printers — this is the correct path.
   */
  printBrowserReceipt(receipt: BillReceiptResponse['receipt']): boolean {
    const widthMm = receipt.paperWidthMm >= 80 ? 80 : 58;

    if (receipt.receiptPngBase64) {
      const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <title>ใบเสร็จ ${receipt.billReference}</title>
  <style>
    @page { margin: 0; size: ${widthMm}mm auto; }
    body { margin: 0; padding: 0; }
    img { display: block; width: ${widthMm}mm; height: auto; }
  </style>
</head>
<body>
  <img src="data:image/png;base64,${receipt.receiptPngBase64}" alt="ใบเสร็จ" />
</body>
</html>`;
      return this.printHtmlInIframe(html);
    }

    const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <title>ใบเสร็จ ${receipt.billReference}</title>
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
    .line { white-space: pre; font-family: 'Courier New', monospace; font-size: 11px; line-height: 1.35; }
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

    return this.printHtmlInIframe(html);
  }

  private printHtmlInIframe(html: string): boolean {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(iframe);

    const frameWindow = iframe.contentWindow;
    const frameDoc = iframe.contentDocument ?? frameWindow?.document;
    if (!frameWindow || !frameDoc) {
      iframe.remove();
      return false;
    }

    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();

    const cleanup = () => {
      setTimeout(() => iframe.remove(), 500);
    };

    let printed = false;
    const triggerPrint = () => {
      if (printed || !iframe.isConnected) return;
      printed = true;
      frameWindow.focus();
      frameWindow.print();
      cleanup();
    };

    const img = frameDoc.querySelector('img');
    if (img) {
      if (img.complete) {
        requestAnimationFrame(() => triggerPrint());
      } else {
        img.addEventListener('load', () => triggerPrint(), { once: true });
        img.addEventListener('error', () => triggerPrint(), { once: true });
        setTimeout(triggerPrint, 2000);
      }
      return true;
    }

    frameWindow.onload = triggerPrint;
    setTimeout(triggerPrint, 400);

    return true;
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
