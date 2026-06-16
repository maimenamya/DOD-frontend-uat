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
      () => this.removePrintFrame(iframe),
    );
    return true;
  }

  private buildReceiptPrintDocument(receipt: BillReceiptResponse['receipt']): {
    html: string;
    rasterPx: number;
    widthMm: number;
    sheetPx: number;
  } {
    const widthMm = receipt.paperWidthMm >= 80 ? 80 : 58;
    const narrow = widthMm < 80;
    /** Standard 58mm dot width — bitmap prints edge-to-edge; safe zone is inner padding. */
    const rasterPx = narrow ? 384 : 576;
    const sidePadPx = narrow ? 44 : 24;
    const sheetPx = rasterPx - sidePadPx * 2;
    const title = escapeHtml(receipt.billReference);
    const shopTitle = escapeHtml(receipt.shopName.trim() || 'บิล');
    const headerBlock = receipt.headerText?.trim()
      ? `<div class="receipt-subhead">${escapeHtml(receipt.headerText.trim())}</div>`
      : '';
    const footerBlock = receipt.footerText?.trim()
      ? `<div class="receipt-foot-text">${escapeHtml(receipt.footerText.trim())}</div>`
      : '';
    const nameMax = narrow ? 13 : 22;
    const amountHeader = narrow ? 'รวม' : 'ราคารวม';
    const bodyFont = narrow ? '11px' : '12px';
    const amtFont = narrow ? '10px' : '11px';

    const kvRow = (label: string, value: string) =>
      `<div class="kv-row"><span class="kv-label">${escapeHtml(label)}</span><span class="kv-value">${escapeHtml(value)}</span></div>`;

    const itemRows = receipt.lines
      .map((line) => {
        const name = escapeHtml(truncateReceiptName(receiptLineDisplayName(line.name), nameMax));
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
      padding: 4px ${sidePadPx}px 10px;
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
    .kv-block { width: 100%; }
    .kv-row {
      display: flex;
      align-items: baseline;
      gap: 4px;
      padding: 1px 0;
    }
    .kv-label {
      flex: 0 0 auto;
      white-space: nowrap;
    }
    .kv-value {
      flex: 0 1 auto;
      text-align: left;
      word-break: break-word;
    }
    .kv-totals .kv-row {
      justify-content: flex-start;
      gap: 4px;
    }
    .kv-totals .kv-value {
      text-align: left;
      white-space: nowrap;
    }
    .items { width: 100%; }
    .item-row {
      display: flex;
      align-items: baseline;
      justify-content: flex-start;
      gap: 4px;
      padding: 1px 0;
    }
    .item-name {
      flex: 0 1 auto;
      min-width: 0;
      max-width: 58%;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    .item-qty {
      flex: 0 0 auto;
      min-width: 1em;
      text-align: right;
      white-space: nowrap;
    }
    .item-amt {
      flex: 0 0 auto;
      text-align: right;
      white-space: nowrap;
      font-size: ${amtFont};
    }
    .items-head {
      font-weight: 700;
    }
    .items-head .item-qty,
    .items-head .item-amt { font-size: ${amtFont}; }
    .grand .kv-row {
      font-size: ${narrow ? '14px' : '16px'};
      font-weight: 700;
      padding: 4px 0;
    }
    .shop-title {
      font-size: ${narrow ? '16px' : '17px'};
      font-weight: 700;
      text-align: center;
      margin: 0 0 2px;
      width: 100%;
    }
    .receipt-subhead {
      text-align: center;
      margin: 0 0 2px;
      width: 100%;
    }
    .bill-title {
      font-size: ${narrow ? '16px' : '17px'};
      font-weight: 700;
      text-align: center;
      margin: 4px 0 6px;
      width: 100%;
    }
    .receipt-foot-text {
      text-align: center;
      margin: 6px 0 2px;
      width: 100%;
    }
    .dash {
      border: none;
      border-top: 1px dashed #000;
      margin: 5px 0;
    }
    .powered {
      text-align: center;
      margin-top: 6px;
      font-size: 10px;
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
  <div class="kv-block kv-info">
    ${kvRow('ทานที่ร้าน', receipt.dineInLabel)}
    ${kvRow('ชื่อพนักงาน', receipt.staffLabel)}
    ${kvRow('เวลาเข้า', receipt.checkedInLabel)}
    ${kvRow('เวลาที่พิมพ์', receipt.printedAtLabel)}
  </div>
  <hr class="dash" />
  <div class="items">
    <div class="item-row items-head">
      <span class="item-name">สินค้า</span>
      <span class="item-qty">Qty</span>
      <span class="item-amt">${amountHeader}</span>
    </div>
    ${itemRows}
  </div>
  <hr class="dash" />
  <div class="kv-block kv-totals">
    ${kvRow('ยอดรวม', `${receipt.totalQuantity}  ${formatReceiptMoney(receipt.grandTotal)}`)}
  </div>
  <hr class="dash" />
  <div class="kv-block kv-totals grand">
    ${kvRow('ทั้งหมด', `฿ ${formatReceiptMoney(receipt.grandTotal)}`)}
  </div>
  </div>
  <footer class="receipt-foot">
  ${footerBlock}
  <div class="powered">Powered by DOD</div>
  </footer>
  </div>
  </div>
</body>
</html>`;
    return { html, rasterPx, widthMm, sheetPx };
  }

  private triggerPrintWhenReady(
    targetWindow: Window,
    widthMm: number,
    rasterPx: number,
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
          const raster = finalizeReceiptCanvas(captured, rasterPx);
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
  const x = Math.floor((targetWidth - source.width) / 2);
  ctx.drawImage(source, x, 0);
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
