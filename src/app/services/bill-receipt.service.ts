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
  /** Create with createPrintFrame() on the same user click — before async API. */
  printFrame?: HTMLIFrameElement | null;
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
   * Hidden iframe in the same tab — avoids Chrome popup blocker (unlike window.open).
   * Call synchronously on button click before HTTP.
   */
  createPrintFrame(): HTMLIFrameElement | null {
    try {
      const iframe = document.createElement('iframe');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.title = 'ใบเสร็จ';
      iframe.style.cssText =
        'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none';
      document.body.appendChild(iframe);
      const win = iframe.contentWindow;
      if (!win || !iframe.contentDocument) {
        iframe.remove();
        return null;
      }
      return iframe;
    } catch {
      return null;
    }
  }

  removePrintFrame(printFrame?: HTMLIFrameElement | null): void {
    try {
      printFrame?.remove();
    } catch {
      // ignore
    }
  }

  shouldUseBrowserPrintOnDesktop(channel?: ReceiptPrintChannel): boolean {
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
      this.removePrintFrame(options?.printFrame);
      return {
        ok: true,
        method: 'none',
        message: 'ปิดการพิมพ์อัตโนมัติ — ตั้งค่าที่เมนู เครื่องพิมพ์ใบเสร็จ',
      };
    }
    if (channel === 'browser_pdf') {
      return this.browserPrintOutcome(receipt, options?.printFrame);
    }
    if (channel === 'bridging_app') {
      this.removePrintFrame(options?.printFrame);
      return this.printViaBridgingApp(receipt, this.detectBridgingPlatform());
    }
    if (channel === 'wifi_raw') {
      const bridged = this.printViaBridgingApp(receipt, this.detectBridgingPlatform());
      if (bridged.ok) {
        this.removePrintFrame(options?.printFrame);
        return bridged;
      }
      return this.browserPrintOutcome(receipt, options?.printFrame);
    }

    const platform = detectReceiptPrintPlatform();
    if (platform === 'desktop') {
      return this.browserPrintOutcome(receipt, options?.printFrame);
    }
    this.removePrintFrame(options?.printFrame);
    return this.printViaBridgingApp(receipt, platform);
  }

  private browserPrintOutcome(
    receipt: BillReceiptResponse['receipt'],
    printFrame?: HTMLIFrameElement | null,
  ): ReceiptPrintOutcome {
    const ok = this.printBrowserReceipt(receipt, printFrame);
    if (!ok) {
      return {
        ok: false,
        method: 'browser',
        message: 'เปิดหน้าพิมพ์ไม่ได้ — ลองกดพิมพ์ใบเสร็จอีกครั้ง',
      };
    }
    return { ok: true, method: 'browser' };
  }

  private detectBridgingPlatform(): 'android' | 'ios' {
    return detectReceiptPrintPlatform() === 'ios' ? 'ios' : 'android';
  }

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

  printBrowserReceipt(
    receipt: BillReceiptResponse['receipt'],
    printFrame?: HTMLIFrameElement | null,
  ): boolean {
    const built = this.buildReceiptPrintDocument(receipt);
    const iframe = printFrame ?? this.createPrintFrame();
    if (!iframe) {
      return false;
    }

    const targetWindow = iframe.contentWindow;
    const frameDoc = iframe.contentDocument ?? targetWindow?.document;
    if (!targetWindow || !frameDoc) {
      this.removePrintFrame(iframe);
      return false;
    }

    try {
      frameDoc.open();
      frameDoc.write(built.html);
      frameDoc.close();
    } catch {
      this.removePrintFrame(iframe);
      return false;
    }

    this.triggerPrintWhenReady(targetWindow, () => this.removePrintFrame(iframe));
    return true;
  }

  private buildReceiptPrintDocument(receipt: BillReceiptResponse['receipt']): {
    html: string;
  } {
    const widthMm = receipt.paperWidthMm >= 80 ? 80 : 58;
    const narrow = widthMm < 80;
    const title = escapeHtml(receipt.billReference);
    const shopTitle = escapeHtml(receipt.shopName.trim() || 'บิล');
    const headerBlock = receipt.headerText?.trim()
      ? `<div class="center">${escapeHtml(receipt.headerText.trim())}</div>`
      : '';
    const footerBlock = receipt.footerText?.trim()
      ? `<div class="center footer">${escapeHtml(receipt.footerText.trim())}</div>`
      : '';
    const nameMax = narrow ? 14 : 22;
    const amountHeader = narrow ? 'รวม' : 'ราคารวม';
    const contentPad = narrow ? '2mm 5mm 2mm 2mm' : '2mm 3mm';
    const qtyCol = narrow ? '6mm' : '9mm';
    const amtCol = narrow ? '12mm' : '16mm';

    const kvRow = (label: string, value: string) =>
      `<tr><td class="kv-label">${escapeHtml(label)}</td><td class="kv-value">${escapeHtml(value)}</td></tr>`;

    const itemRows = receipt.lines
      .map((line) => {
        const name = escapeHtml(truncateReceiptName(receiptLineDisplayName(line.name), nameMax));
        const qty = escapeHtml(String(line.quantity));
        const amount = escapeHtml(formatReceiptMoney(line.lineTotal));
        return `<tr><td class="item-name">${name}</td><td class="item-qty">${qty}</td><td class="item-amt">${amount}</td></tr>`;
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
    @page { margin: 0; size: ${widthMm}mm auto; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: ${widthMm}mm;
      max-width: ${widthMm}mm;
      overflow: hidden;
    }
    body {
      font-family: 'Sarabun', 'Tahoma', sans-serif;
      font-size: ${narrow ? '8.5pt' : '10pt'};
      line-height: 1.25;
      padding: ${contentPad};
      color: #000;
    }
    .sheet { width: 100%; max-width: 100%; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .shop-title { font-size: ${narrow ? '13pt' : '15pt'}; font-weight: 700; text-align: center; margin: 0 0 2px; }
    .bill-title { font-size: ${narrow ? '13pt' : '15pt'}; font-weight: 700; text-align: center; margin: 4px 0 6px; }
    .center { text-align: center; margin: 2px 0; }
    .footer { margin-top: 6px; }
    .kv-label {
      width: 36%;
      vertical-align: top;
      padding: 1px 2px 1px 0;
      white-space: nowrap;
    }
    .kv-value {
      width: 64%;
      vertical-align: top;
      padding: 1px 0;
      text-align: right;
      word-break: break-word;
    }
    .dash {
      border: none;
      border-top: 1px dashed #000;
      margin: 5px 0;
    }
    .items .item-name {
      word-break: break-word;
      overflow-wrap: anywhere;
      padding: 1px 2px 1px 0;
      vertical-align: top;
    }
    .items .item-qty {
      width: ${qtyCol};
      text-align: right;
      padding: 1px 0;
      vertical-align: top;
      white-space: nowrap;
    }
    .items .item-amt {
      width: ${amtCol};
      text-align: right;
      padding: 1px 0;
      vertical-align: top;
      white-space: nowrap;
      font-size: ${narrow ? '8pt' : '9.5pt'};
    }
    .items-head { font-weight: 700; }
    .items-head .item-qty,
    .items-head .item-amt { font-size: ${narrow ? '8pt' : '9.5pt'}; }
    .grand td {
      font-size: ${narrow ? '12pt' : '14pt'};
      font-weight: 700;
      padding: 4px 0;
    }
    .grand .kv-value { white-space: nowrap; }
    .powered { text-align: center; margin-top: 8px; font-size: 8pt; }
  </style>
</head>
<body>
  <div class="sheet">
  <div class="shop-title">${shopTitle}</div>
  ${headerBlock}
  <div class="bill-title">บิล</div>
  <table class="kv">
    ${kvRow('ทานที่ร้าน', receipt.dineInLabel)}
    ${kvRow('ชื่อพนักงาน', receipt.staffLabel)}
    ${kvRow('เวลาเข้า', receipt.checkedInLabel)}
    ${kvRow('เวลาที่พิมพ์', receipt.printedAtLabel)}
  </table>
  <hr class="dash" />
  <table class="items">
    <colgroup>
      <col />
      <col style="width:${qtyCol}" />
      <col style="width:${amtCol}" />
    </colgroup>
    <tr class="items-head">
      <td class="item-name">สินค้า</td>
      <td class="item-qty">Qty</td>
      <td class="item-amt">${amountHeader}</td>
    </tr>
    ${itemRows}
  </table>
  <hr class="dash" />
  <table class="kv">
    ${kvRow('ยอดรวม', `${receipt.totalQuantity}  ${formatReceiptMoney(receipt.grandTotal)}`)}
  </table>
  <hr class="dash" />
  <table class="kv grand">
    ${kvRow('ทั้งหมด', `฿${formatReceiptMoney(receipt.grandTotal)}`)}
  </table>
  ${footerBlock}
  <div class="powered">Powered by DOD</div>
  </div>
</body>
</html>`;
    return { html };
  }

  private triggerPrintWhenReady(targetWindow: Window, cleanup?: () => void): void {
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
        await new Promise((resolve) => setTimeout(resolve, 200));
        try {
          targetWindow.focus();
          targetWindow.print();
        } finally {
          setTimeout(() => cleanup?.(), 1000);
        }
      };
      void run();
    };

    if (frameDoc.fonts?.status === 'loaded') {
      triggerPrint();
      return;
    }
    frameDoc.fonts?.addEventListener('loadingdone', () => triggerPrint(), { once: true });
    targetWindow.addEventListener('load', () => triggerPrint(), { once: true });
    setTimeout(triggerPrint, 2500);
  }

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

/** บิลเก่าอาจเก็บ "รันดื่ม ชื่อ (ตำแหน่ง)" — แสดงบนใบเสร็จเป็น "ดื่ม ชื่อ" */
function receiptLineDisplayName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.startsWith('ดื่ม ')) return trimmed;
  if (trimmed.startsWith('รันดื่ม ')) {
    const rest = trimmed
      .slice('รันดื่ม '.length)
      .replace(/\s*\([^)]*\)\s*$/, '')
      .trim();
    return rest ? `ดื่ม ${rest}` : 'ดื่ม';
  }
  return trimmed;
}
