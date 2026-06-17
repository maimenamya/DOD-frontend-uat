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

    this.triggerPrintWhenReady(
      targetWindow,
      built.widthMm,
      built.rasterPx,
      built.printBottomPadPx,
      () => this.removePrintFrame(iframe),
    );
    return true;
  }

  private buildReceiptPrintDocument(receipt: BillReceiptResponse['receipt']): {
    html: string;
    rasterPx: number;
    widthMm: number;
    sheetPx: number;
    printBottomPadPx: number;
  } {
    const widthMm = receipt.paperWidthMm >= 80 ? 80 : 58;
    const narrow = widthMm < 80;
    /** Standard 58mm dot width — bitmap prints edge-to-edge. */
    const rasterPx = narrow ? 384 : 576;
    const padLeftPx = narrow ? 10 : 12;
    const padRightPx = narrow ? 22 : 14;
    const padBottomPx = narrow ? 24 : 16;
    const printBottomPadPx = narrow ? 16 : 12;
    const sheetPx = rasterPx - padLeftPx - padRightPx;
    const title = escapeHtml(receipt.billReference);
    const shopTitle = escapeHtml(receipt.shopName.trim() || 'บิล');
    const headerBlock = receipt.headerText?.trim()
      ? `<div class="receipt-subhead">${escapeHtml(receipt.headerText.trim())}</div>`
      : '';
    const footerBlock = receipt.footerText?.trim()
      ? `<div class="receipt-foot-text">${escapeHtml(receipt.footerText.trim())}</div>`
      : '';
    const nameMax = narrow ? 11 : 22;
    const amountHeader = narrow ? 'รวม' : 'ราคารวม';
    const bodyFont = narrow ? '18px' : '19px';
    const amtFont = narrow ? '16px' : '17px';
    const headFont = narrow ? '23px' : '24px';
    const grandFont = narrow ? '21px' : '22px';
    const footFont = narrow ? '16px' : '14px';

    const itemsColgroup = `<colgroup>
      <col style="width:52%" />
      <col style="width:12%" />
      <col style="width:36%" />
    </colgroup>`;

    const kvRow = (label: string, value: string) =>
      `<tr><td class="kv-label">${escapeHtml(label)}</td><td class="kv-value">${escapeHtml(value)}</td></tr>`;

    const itemGridRow = (label: string, qty: string, amount: string, rowClass = '') => {
      const cls = rowClass ? ` class="${rowClass}"` : '';
      return `<tr${cls}><td class="item-name">${escapeHtml(label)}</td><td class="item-qty">${escapeHtml(qty)}</td><td class="item-amt">${escapeHtml(amount)}</td></tr>`;
    };

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
      width: ${rasterPx}px;
      max-width: ${rasterPx}px;
      background: #fff;
    }
    body {
      font-family: 'Sarabun', 'Tahoma', sans-serif;
      font-size: ${bodyFont};
      line-height: 1.25;
      padding: 0;
      color: #000;
    }
    .raster-frame {
      width: ${rasterPx}px;
      max-width: ${rasterPx}px;
      margin: 0;
      padding: 0 ${padRightPx}px ${padBottomPx}px ${padLeftPx}px;
      background: #fff;
    }
    .sheet {
      width: 100%;
      max-width: 100%;
    }
    .receipt-head,
    .receipt-foot {
      width: 100%;
      text-align: center;
    }
    .receipt-body { width: 100%; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .kv-label {
      width: 42%;
      vertical-align: top;
      padding: 1px 2px 1px 0;
      white-space: nowrap;
    }
    .kv-value {
      width: 58%;
      vertical-align: top;
      padding: 1px 0;
      text-align: right;
      word-break: break-word;
    }
    .items .item-name {
      word-break: break-word;
      overflow-wrap: anywhere;
      padding: 1px 2px 1px 0;
      vertical-align: top;
    }
    .items .item-qty {
      width: 12%;
      text-align: center;
      padding: 1px 2px;
      vertical-align: top;
      white-space: nowrap;
    }
    .items .item-amt {
      width: 36%;
      text-align: right;
      padding: 1px 10px 1px 0;
      vertical-align: top;
      white-space: nowrap;
      font-size: ${amtFont};
    }
    .items-head { font-weight: 700; }
    .items-head .item-qty,
    .items-head .item-amt { font-size: ${amtFont}; }
    .grand .item-name,
    .grand .item-qty,
    .grand .item-amt {
      font-size: ${grandFont};
      font-weight: 700;
      padding: 4px 0;
    }
    .shop-title {
      font-size: ${headFont};
      font-weight: 700;
      text-align: center;
      margin: 0 0 2px;
      width: 100%;
    }
    .receipt-subhead {
      text-align: center;
      margin: 0 0 2px;
      width: 100%;
      font-size: ${bodyFont};
    }
    .bill-title {
      font-size: ${headFont};
      font-weight: 700;
      text-align: center;
      margin: 4px 0 6px;
      width: 100%;
    }
    .receipt-foot-text {
      text-align: center;
      margin: 6px 0 2px;
      width: 100%;
      font-size: ${bodyFont};
    }
    .dash {
      border: none;
      border-top: 1px dashed #000;
      margin: 5px 0;
    }
    .powered {
      text-align: center;
      margin-top: 6px;
      font-size: ${footFont};
      width: 100%;
    }
  </style>
</head>
<body>
  <div class="raster-frame">
  <div class="sheet">
  <header class="receipt-head">
  <div class="shop-title">${shopTitle}</div>
  ${headerBlock}
  <div class="bill-title">บิล</div>
  </header>
  <div class="receipt-body">
  <table class="kv">
    ${kvRow('ทานที่ร้าน', receipt.dineInLabel)}
    ${kvRow('ชื่อพนักงาน', receipt.staffLabel)}
    ${kvRow('เวลาเข้า', receipt.checkedInLabel)}
    ${kvRow('เวลาที่พิมพ์', receipt.printedAtLabel)}
  </table>
  <hr class="dash" />
  <table class="items">
    ${itemsColgroup}
    <tr class="items-head">
      <td class="item-name">สินค้า</td>
      <td class="item-qty">Qty</td>
      <td class="item-amt">${amountHeader}</td>
    </tr>
    ${itemRows}
  </table>
  <hr class="dash" />
  <table class="items">
    ${itemsColgroup}
    ${itemGridRow('ยอดรวม', String(receipt.totalQuantity), formatReceiptMoney(receipt.grandTotal))}
  </table>
  <hr class="dash" />
  <table class="items grand">
    ${itemsColgroup}
    ${itemGridRow('ทั้งหมด', '', `฿ ${formatReceiptMoney(receipt.grandTotal)}`, 'grand')}
  </table>
  </div>
  <footer class="receipt-foot">
  ${footerBlock}
  <div class="powered">Powered by DOD</div>
  </footer>
  </div>
  </div>
</body>
</html>`;
    return { html, rasterPx, widthMm, sheetPx, printBottomPadPx };
  }

  private triggerPrintWhenReady(
    targetWindow: Window,
    widthMm: number,
    rasterPx: number,
    printBottomPadPx: number,
    cleanup?: () => void,
  ): void {
    const frameDoc = targetWindow.document;
    let printed = false;

    const triggerPrint = () => {
      if (printed) return;
      printed = true;
      const run = async () => {
        try {
          await frameDoc.fonts?.ready;
          await new Promise((resolve) => setTimeout(resolve, 350));

          const rasterFrame = frameDoc.querySelector('.raster-frame');
          if (!rasterFrame) {
            targetWindow.focus();
            targetWindow.print();
            return;
          }

          const frameEl = rasterFrame as HTMLElement;
          const captureHeight = Math.max(frameEl.scrollHeight, frameEl.offsetHeight);
          const { default: html2canvas } = await import('html2canvas');
          const captured = await html2canvas(frameEl, {
            backgroundColor: '#ffffff',
            scale: 1,
            useCORS: true,
            logging: false,
            width: rasterPx,
            height: captureHeight,
            windowWidth: rasterPx,
            windowHeight: captureHeight,
          });
          const raster = padReceiptCanvasBottom(
            finalizeReceiptCanvas(captured, rasterPx),
            printBottomPadPx,
          );
          const dataUrl = raster.toDataURL('image/png');

          frameDoc.open();
          frameDoc.write(`<!DOCTYPE html>
<html lang="th"><head><meta charset="utf-8" />
<style>
  @page { margin: 0; size: ${widthMm}mm auto; }
  html, body { margin: 0; padding: 0; width: ${widthMm}mm; }
  img {
    display: block;
    width: ${widthMm}mm;
    max-width: ${widthMm}mm;
    height: auto;
    margin: 0;
  }
</style></head>
<body><img src="${dataUrl}" alt="ใบเสร็จ" /></body></html>`);
          frameDoc.close();

          await new Promise((resolve) => setTimeout(resolve, 150));
          targetWindow.focus();
          targetWindow.print();
        } catch {
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
    setTimeout(triggerPrint, 3000);
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

function padReceiptCanvasBottom(source: HTMLCanvasElement, extraPx: number): HTMLCanvasElement {
  if (extraPx <= 0) return source;
  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = source.height + extraPx;
  const ctx = out.getContext('2d');
  if (!ctx) return source;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(source, 0, 0);
  return out;
}

function finalizeReceiptCanvas(source: HTMLCanvasElement, targetWidth: number): HTMLCanvasElement {
  if (source.width > targetWidth) {
    return scaleCanvasToWidth(source, targetWidth);
  }
  if (source.width === targetWidth) return source;
  const out = document.createElement('canvas');
  out.width = targetWidth;
  out.height = source.height;
  const ctx = out.getContext('2d');
  if (!ctx) return source;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  // Left-align — centering added empty left gutter on drivers that already shift right.
  ctx.drawImage(source, 0, 0);
  return out;
}

function scaleCanvasToWidth(source: HTMLCanvasElement, targetWidth: number): HTMLCanvasElement {
  const scaled = document.createElement('canvas');
  scaled.width = targetWidth;
  scaled.height = Math.max(1, Math.round(source.height * (targetWidth / source.width)));
  const ctx = scaled.getContext('2d');
  if (!ctx) return source;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, scaled.width, scaled.height);
  ctx.drawImage(source, 0, 0, scaled.width, scaled.height);
  return scaled;
}
