import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';
import type { BillReceiptResponse } from '../models/bill-receipt';
import type { ReceiptPrintChannel } from '../models/shop-receipt-printer';
import { detectReceiptPrintPlatform } from '../utils/receipt-print-platform.util';

export type ReceiptPrintOutcome = {
  ok: boolean;
  method: 'browser' | 'rawbt' | 'thermer' | 'none';
  message?: string;
};

export type PrintReceiptOptions = {
  /** Create with createPrintFrame() on the same user click — before async API. */
  printFrame?: HTMLIFrameElement | null;
};

/** PC USB browser print — slightly narrower than nominal paper (driver variance). */
const PC_USB_PRINT_WIDTH_SCALE = 1;
const RAWBT_PACKAGE = 'ru.a402d.rawbtprinter';
/** iOS Safari truncates very long custom-scheme URLs — keep Thermer payload under this. */
const THERMER_MAX_URL_LEN = 180_000;

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

  /** Desktop only — mobile uses on-screen sheet (iOS blocks hidden iframe print after async). */
  shouldPreparePrintFrame(): boolean {
    return detectReceiptPrintPlatform() === 'desktop';
  }

  /** @deprecated use shouldPreparePrintFrame */
  shouldUseBrowserPrintOnDesktop(channel?: ReceiptPrintChannel): boolean {
    void channel;
    return this.shouldPreparePrintFrame();
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
    if (channel === 'thermer') {
      this.removePrintFrame(options?.printFrame);
      return this.printViaThermer(receipt);
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

    // auto on mobile — Android: RawBT; iPhone/iPad: Thermer (html2canvas receipt, not server PNG).
    if (platform === 'android') {
      this.removePrintFrame(options?.printFrame);
      return this.printViaBridgingApp(receipt, 'android');
    }
    this.removePrintFrame(options?.printFrame);
    const thermer = this.printViaThermer(receipt);
    if (thermer.ok) return thermer;
    return this.browserPrintOutcome(receipt, options?.printFrame);
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
    if (detectReceiptPrintPlatform() !== 'desktop') {
      return {
        ok: true,
        method: 'browser',
        message: 'แสดงใบเสร็จแล้ว — กดปุ่ม พิมพ์ ด้านล่าง',
      };
    }
    return { ok: true, method: 'browser' };
  }

  private detectBridgingPlatform(): 'android' | 'ios' {
    return detectReceiptPrintPlatform() === 'ios' ? 'ios' : 'android';
  }

  printViaThermer(receipt: BillReceiptResponse['receipt']): ReceiptPrintOutcome {
    void this.dispatchThermerPrint(receipt);
    return {
      ok: true,
      method: 'thermer',
      message: 'กำลังส่งใบเสร็จไป Thermer...',
    };
  }

  /** Same html2canvas receipt as PC → JPEG → thermer:// (not backend PNG — avoids stretch). */
  private async dispatchThermerPrint(receipt: BillReceiptResponse['receipt']): Promise<void> {
    for (const quality of [0.88, 0.78, 0.68, 0.58]) {
      const base64 = await this.renderReceiptJpegBase64(receipt, quality);
      if (!base64) break;
      const url = thermerUrlFromEntries({
        '0': { type: 1, align: 0, base64Image: base64 },
      });
      if (url && url.length <= THERMER_MAX_URL_LEN && this.navigatePrintUrl(url)) {
        return;
      }
    }
    this.showMobileReceiptPrintSheet(receipt);
  }

  private async renderReceiptJpegBase64(
    receipt: BillReceiptResponse['receipt'],
    quality: number,
  ): Promise<string | null> {
    const dataUrl = await this.renderReceiptDataUrlForMobile(receipt, {
      format: 'jpeg',
      jpegQuality: quality,
    });
    if (!dataUrl) return null;
    const match = dataUrl.match(/^data:image\/jpeg;base64,(.+)$/);
    return match?.[1] ?? null;
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
    this.removePrintFrame(printFrame);
    if (detectReceiptPrintPlatform() !== 'desktop') {
      return this.showMobileReceiptPrintSheet(receipt);
    }
    return this.printDesktopBrowserReceipt(receipt);
  }

  private printDesktopBrowserReceipt(receipt: BillReceiptResponse['receipt']): boolean {
    const iframe = this.createPrintFrame();
    if (!iframe) {
      return false;
    }

    const targetWindow = iframe.contentWindow;
    const frameDoc = iframe.contentDocument ?? targetWindow?.document;
    if (!targetWindow || !frameDoc) {
      this.removePrintFrame(iframe);
      return false;
    }

    const useServerPng =
      receipt.receiptFormat === 'png_raster' && receipt.receiptPngBase64.trim().length > 0;

    try {
      if (useServerPng) {
        this.runPngDesktopPrint(targetWindow, frameDoc, receipt, iframe);
      } else {
        frameDoc.open();
        const built = this.buildReceiptPrintDocument(receipt);
        frameDoc.write(built.html);
        frameDoc.close();
        this.triggerPrintWhenReady(
          targetWindow,
          built.widthMm,
          built.rasterPx,
          built.printBottomPadPx,
          () => this.removePrintFrame(iframe),
        );
      }
    } catch {
      this.removePrintFrame(iframe);
      return false;
    }

    return true;
  }

  /** Same PNG as Tablet + RawBT (backend receipt-image.util.ts). */
  private buildReceiptPngPrintHtml(
    receipt: BillReceiptResponse['receipt'],
    imageSrc: string,
  ): string {
    const widthMm = receipt.paperWidthMm >= 80 ? 80 : 58;
    const printWidthMm = Math.round(widthMm * PC_USB_PRINT_WIDTH_SCALE * 10) / 10;
    const rasterPx = widthMm >= 80 ? 576 : 384;
    return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <title>ใบเสร็จ</title>
  <style>
    @page { margin: 0; size: ${printWidthMm}mm auto; }
    html, body {
      margin: 0;
      padding: 0;
      width: ${printWidthMm}mm;
      max-width: ${printWidthMm}mm;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    img {
      display: block;
      width: ${printWidthMm}mm;
      max-width: ${printWidthMm}mm;
      height: auto;
      margin: 0;
      image-rendering: crisp-edges;
      image-rendering: pixelated;
    }
  </style>
</head>
<body>
  <img id="receipt-img" width="${rasterPx}" src="${imageSrc}" alt="ใบเสร็จ" />
</body>
</html>`;
  }

  /** B&W threshold; lock width to thermal dot count (384/576) like RawBT raster. */
  private thresholdReceiptPngDataUrl(
    base64: string,
    rasterPx: number,
    threshold = 170,
  ): Promise<string> {
    const clean = base64.replace(/\s/g, '');
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const srcW = img.naturalWidth;
        const srcH = img.naturalHeight;
        if (srcW <= 0 || srcH <= 0) {
          reject(new Error('png size'));
          return;
        }
        const outH = Math.max(1, Math.round((srcH * rasterPx) / srcW));
        const canvas = document.createElement('canvas');
        canvas.width = rasterPx;
        canvas.height = outH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('canvas'));
          return;
        }
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, rasterPx, outH);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
          const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          const v = gray < threshold ? 0 : 255;
          d[i] = v;
          d[i + 1] = v;
          d[i + 2] = v;
          d[i + 3] = 255;
        }
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('png load'));
      img.src = `data:image/png;base64,${clean}`;
    });
  }

  private runPngDesktopPrint(
    targetWindow: Window,
    frameDoc: Document,
    receipt: BillReceiptResponse['receipt'],
    iframe: HTMLIFrameElement,
  ): void {
    const cleanup = () => this.removePrintFrame(iframe);
    const finish = (imageSrc: string) => {
      try {
        frameDoc.open();
        frameDoc.write(this.buildReceiptPngPrintHtml(receipt, imageSrc));
        frameDoc.close();
        this.triggerPngPrintWhenReady(targetWindow, cleanup);
      } catch {
        cleanup();
      }
    };

    const rasterPx = receipt.paperWidthMm >= 80 ? 576 : 384;
    void this.thresholdReceiptPngDataUrl(receipt.receiptPngBase64, rasterPx)
      .then(finish)
      .catch(() => {
        const fallback = `data:image/png;base64,${receipt.receiptPngBase64.replace(/\s/g, '')}`;
        finish(fallback);
      });
  }

  private triggerPngPrintWhenReady(targetWindow: Window, cleanup?: () => void): void {
    const frameDoc = targetWindow.document;
    let printed = false;

    const triggerPrint = () => {
      if (printed) return;
      printed = true;
      targetWindow.focus();
      targetWindow.print();
      setTimeout(() => cleanup?.(), 1000);
    };

    const img = frameDoc.getElementById('receipt-img') as HTMLImageElement | null;
    if (img?.complete && img.naturalWidth > 0) {
      triggerPrint();
      return;
    }
    img?.addEventListener('load', () => triggerPrint(), { once: true });
    img?.addEventListener('error', () => triggerPrint(), { once: true });
    targetWindow.addEventListener('load', () => triggerPrint(), { once: true });
    setTimeout(triggerPrint, 3000);
  }

  /** iOS/Android — preview + print on second tap (keeps user gesture for window.print). */
  private showMobileReceiptPrintSheet(receipt: BillReceiptResponse['receipt']): boolean {
    try {
      document.getElementById('dod-receipt-print-overlay')?.remove();

      const widthMm = receipt.paperWidthMm >= 80 ? 80 : 58;

      const overlay = document.createElement('div');
      overlay.id = 'dod-receipt-print-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-label', 'ใบเสร็จ');
      overlay.style.cssText =
        'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,0.55);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';

      const panel = document.createElement('div');
      panel.style.cssText =
        'background:#fff;width:100%;max-width:22rem;border-radius:12px;padding:12px;box-sizing:border-box;max-height:85vh;display:flex;flex-direction:column';

      const title = document.createElement('p');
      title.textContent = 'ใบเสร็จ';
      title.style.cssText =
        'margin:0 0 8px;font:600 18px Sarabun,Tahoma,sans-serif;text-align:center;color:#111';

      const preview = document.createElement('div');
      preview.style.cssText =
        'flex:1;overflow:auto;background:#f8f8f8;border-radius:8px;padding:8px;display:flex;justify-content:center';

      const img = document.createElement('img');
      img.alt = 'ใบเสร็จ';
      img.style.cssText = `display:block;width:${widthMm}mm;max-width:100%;height:auto`;
      img.style.minHeight = '120px';
      void this.renderReceiptDataUrlForMobile(receipt, { format: 'jpeg', jpegQuality: 0.88 }).then(
        (url) => {
          if (url) img.src = url;
        },
      );
      preview.appendChild(img);

      const hint = document.createElement('p');
      hint.textContent = 'กด พิมพ์ แล้วเลือกเครื่องพิมพ์หรือบันทึก PDF';
      hint.style.cssText =
        'margin:10px 0 0;font:400 14px Sarabun,Tahoma,sans-serif;text-align:center;color:#555';

      const btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex;gap:10px;margin-top:12px';

      const printBtn = document.createElement('button');
      printBtn.type = 'button';
      printBtn.textContent = 'พิมพ์';
      printBtn.style.cssText =
        'flex:1;padding:12px 8px;font:600 17px Sarabun,Tahoma,sans-serif;border:none;border-radius:8px;background:#4f46e5;color:#fff';

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.textContent = 'ปิด';
      closeBtn.style.cssText =
        'flex:1;padding:12px 8px;font:600 17px Sarabun,Tahoma,sans-serif;border:1px solid #ccc;border-radius:8px;background:#fff;color:#111';

      const cleanup = () => overlay.remove();

      closeBtn.addEventListener('click', cleanup);
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) cleanup();
      });

      printBtn.addEventListener('click', () => {
        void (async () => {
          printBtn.disabled = true;
          printBtn.textContent = 'กำลังพิมพ์...';
          try {
            const url = await this.renderReceiptDataUrlForMobile(receipt, {
              format: 'jpeg',
              jpegQuality: 0.88,
            });
            if (!url) {
              printBtn.disabled = false;
              printBtn.textContent = 'พิมพ์';
              return;
            }
            img.src = url;
            this.openMobilePrintWindow(url, widthMm);
          } finally {
            printBtn.disabled = false;
            printBtn.textContent = 'พิมพ์';
          }
        })();
      });

      btnRow.appendChild(printBtn);
      btnRow.appendChild(closeBtn);
      panel.appendChild(title);
      panel.appendChild(preview);
      panel.appendChild(hint);
      panel.appendChild(btnRow);
      overlay.appendChild(panel);
      document.body.appendChild(overlay);
      return true;
    } catch {
      return false;
    }
  }

  private openMobilePrintWindow(dataUrl: string, widthMm: number): void {
    const html = buildReceiptImagePrintHtml(dataUrl, widthMm, true);
    const popup = window.open('', '_blank');
    if (popup) {
      popup.document.open();
      popup.document.write(html);
      popup.document.close();
      return;
    }
    this.printImageInFullscreenFrame(html);
  }

  private printImageInFullscreenFrame(html: string): void {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;border:0;z-index:100001;background:#fff';
    document.body.appendChild(iframe);
    const win = iframe.contentWindow;
    const doc = iframe.contentDocument ?? win?.document;
    if (!win || !doc) {
      iframe.remove();
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
    const remove = () => iframe.remove();
    win.addEventListener('afterprint', remove, { once: true });
    setTimeout(remove, 15000);
  }

  private async renderReceiptDataUrlForMobile(
    receipt: BillReceiptResponse['receipt'],
    opts?: { format?: 'png' | 'jpeg'; jpegQuality?: number },
  ): Promise<string | null> {
    const built = this.buildReceiptPrintDocument(receipt);
    const iframe = document.createElement('iframe');
    iframe.style.cssText =
      'position:fixed;left:-9999px;top:0;width:400px;height:1200px;border:0;opacity:0;pointer-events:none';
    document.body.appendChild(iframe);

    const targetWindow = iframe.contentWindow;
    const frameDoc = iframe.contentDocument ?? targetWindow?.document;
    if (!targetWindow || !frameDoc) {
      iframe.remove();
      return null;
    }

    try {
      frameDoc.open();
      frameDoc.write(built.html);
      frameDoc.close();
      await frameDoc.fonts?.ready;
      await new Promise((resolve) => setTimeout(resolve, 300));

      const rasterFrame = frameDoc.querySelector('.raster-frame') as HTMLElement | null;
      if (!rasterFrame) return null;

      const captureHeight = Math.max(rasterFrame.scrollHeight, rasterFrame.offsetHeight);
      const { default: html2canvas } = await import('html2canvas');
      const captured = await html2canvas(rasterFrame, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
        width: built.rasterPx,
        height: captureHeight,
        windowWidth: built.rasterPx,
        windowHeight: captureHeight,
      });
      const raster = padReceiptCanvasBottom(
        finalizeReceiptCanvas(captured, built.rasterPx),
        built.printBottomPadPx,
      );
      if (opts?.format === 'jpeg') {
        return raster.toDataURL('image/jpeg', opts.jpegQuality ?? 0.88);
      }
      return raster.toDataURL('image/png');
    } catch {
      return null;
    } finally {
      iframe.remove();
    }
  }

  private buildReceiptPrintDocument(receipt: BillReceiptResponse['receipt']): {
    html: string;
    rasterPx: number;
    widthMm: number;
    sheetPx: number;
    printBottomPadPx: number;
    padLeftPx: number;
  } {
    const widthMm = receipt.paperWidthMm >= 80 ? 80 : 58;
    const narrow = widthMm < 80;
    /** Standard 58mm dot width — bitmap prints edge-to-edge. */
    const rasterPx = narrow ? 384 : 576;
    const padLeftPx = narrow ? 4 : 10;
    const padRightPx = narrow ? 30 : 20;
    const padBottomPx = narrow ? 80 : 40;
    const printBottomPadPx = narrow ? 120 : 40;
    const sheetPx = rasterPx - padLeftPx - padRightPx;
    const title = escapeHtml(receipt.billReference);
    const shopTitle = escapeHtml(receipt.shopName.trim() || 'บิล');
    const headerBlock = receipt.headerText?.trim()
      ? `<div class="receipt-subhead">${escapeHtml(receipt.headerText.trim())}</div>`
      : '';
    const footerBlock = receipt.footerText?.trim()
      ? `<div class="receipt-foot-text">${escapeHtml(receipt.footerText.trim())}</div>`
      : '';
    const colNamePx = narrow ? Math.floor(sheetPx * 0.50) : Math.floor(sheetPx * 0.52);
    const colQtyPx = narrow ? 36 : 44;
    const colAmtPx = sheetPx - colNamePx - colQtyPx;
    const nameMax = narrow ? 13 : 20;
    const amountHeader = 'ราคารวม';
    const bodyFont = narrow ? '21px' : '23px';
    const itemsHeadFont = narrow ? '23px' : '25px';
    const headFont = narrow ? '30px' : '32px';
    const grandFont = narrow ? '28px' : '31px';
    const footFont = narrow ? '16px' : '16px';
    const infoFont = narrow ? '17px' : '18px';
    const amtPadRightPx = narrow ? 8 : 10;
    const footerGapPx = 100;

    const metaRow = (label: string, value: string) =>
      `<div class="meta-row"><span class="meta-label">${escapeHtml(label)}:</span><span class="meta-value">${escapeHtml(formatReceiptDateTimeLabel(value))}</span></div>`;

    const itemsColgroup = `<colgroup>
      <col style="width:${colNamePx}px" />
      <col style="width:${colQtyPx}px" />
      <col style="width:${colAmtPx}px" />
    </colgroup>`;

    const amtCell = (value: string) =>
      `<td class="item-amt"><span class="amt-val">${value}</span></td>`;

    const itemGridRow = (label: string, qty: string, amount: string, rowClass = '') => {
      const cls = rowClass ? ` class="${rowClass}"` : '';
      const qtyCell = `<td class="item-qty"><span class="qty-val">${escapeHtml(qty)}</span></td>`;
      return `<tr${cls}><td class="item-name">${escapeHtml(label)}</td>${qtyCell}${amtCell(escapeHtml(amount))}</tr>`;
    };

    const grandRow = (label: string, amount: string) =>
      itemGridRow(label, '', amount, 'grand-row');

    const zoneDash = buildReceiptZoneDash(sheetPx);
    const zoneSpacer = '<div class="zone-spacer" aria-hidden="true"></div>';

    const itemRows = receipt.lines
      .map((line) => {
        const name = escapeHtml(truncateReceiptName(receiptLineDisplayName(line.name), nameMax));
        const qty = escapeHtml(String(line.quantity));
        const amount = escapeHtml(formatReceiptMoney(line.lineTotal));
        return `<tr class="item-row"><td class="item-name">${name}</td><td class="item-qty"><span class="qty-val">${qty}</span></td>${amtCell(amount)}</tr>`;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <title>ใบเสร็จ ${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400&display=swap" rel="stylesheet" />
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
      font-weight: 400;
      line-height: 1.65;
      padding: 0;
      color: #000;
      -webkit-font-smoothing: antialiased;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
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
    .receipt-foot {
      display: block;
      box-sizing: border-box;
      width: 100%;
      margin: 0;
      padding: ${footerGapPx}px 0 16px;
      background: #fff;
      overflow: visible;
      text-align: center;
    }
    .receipt-foot-inner {
      display: block;
      width: 100%;
      text-align: center;
    }
    .receipt-body { width: 100%; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .meta {
      width: 100%;
      margin-bottom: 0;
      padding-bottom: 8px;
    }
    .meta-row {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 4px 0;
      font-size: ${infoFont};
      font-weight: 400;
      line-height: 1.75;
      color: #000;
      overflow: visible;
    }
    .meta-label {
      flex: 0 0 auto;
      text-align: left;
      white-space: nowrap;
    }
    .meta-value {
      flex: 1 1 auto;
      min-width: 0;
      text-align: right;
      white-space: nowrap;
      overflow: visible;
      font-variant-numeric: tabular-nums;
      padding-right: ${amtPadRightPx}px;
      line-height: 1.75;
    }
    table.items { width: 100%; table-layout: fixed; }
    table.items-list {
      border-collapse: separate;
      border-spacing: 0 11px;
    }
    .items td {
      font-size: ${bodyFont};
      font-weight: 400;
      color: #000;
      min-width: 0;
      vertical-align: middle;
      padding: 0;
    }
    .items-list .items-head td {
      vertical-align: bottom;
      padding-bottom: 2px;
    }
    .items .item-name {
      word-break: break-word;
      overflow-wrap: anywhere;
      text-align: left;
      overflow: visible;
      padding: 0 4px 0 0;
    }
    .items .item-qty {
      text-align: center;
      overflow: visible;
      padding: 0;
    }
    .qty-val {
      display: block;
      width: 100%;
      text-align: center;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
      line-height: 1.45;
    }
    .items .item-amt {
      padding: 0;
      overflow: visible;
      width: ${colAmtPx}px;
      max-width: ${colAmtPx}px;
    }
    .amt-val {
      display: block;
      width: 100%;
      box-sizing: border-box;
      text-align: right;
      padding: 0 ${amtPadRightPx}px 0 0;
      white-space: nowrap;
      overflow: visible;
      font-variant-numeric: tabular-nums;
      line-height: 1.45;
    }
    .items-head { font-weight: 400; font-size: ${itemsHeadFont}; }
    .items-head td { font-weight: 400; font-size: ${itemsHeadFont}; }
    .items-head .item-qty { text-align: center; }
    tr.subtotal-row .qty-val,
    tr.subtotal-row .amt-val {
      font-variant-numeric: tabular-nums;
    }
    .zone-dash {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 4px;
      width: 100%;
      margin: 70px 0;
      overflow: hidden;
    }
    .zone-spacer {
      width: 100%;
      margin: 38px 0;
      height: 1px;
      visibility: hidden;
    }
    .zone-dash-seg {
      display: block;
      width: 10px;
      height: 4px;
      background: #000;
      flex: 0 0 10px;
    }
    tr.grand-row .item-name {
      font-size: ${grandFont};
      font-weight: 400;
      padding-top: 8px;
      padding-bottom: 6px;
    }
    tr.grand-row .amt-val {
      font-size: ${grandFont};
      font-weight: 400;
      padding: 8px ${amtPadRightPx}px 6px 0;
    }
    .shop-title {
      font-size: ${headFont};
      font-weight: 400;
      text-align: center;
      margin: 0 0 4px;
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
      font-weight: 400;
      text-align: center;
      margin: 2px 0 0;
      width: 100%;
    }
    .receipt-foot-text {
      text-align: center;
      margin: 6px 0 2px;
      width: 100%;
      font-size: ${bodyFont};
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
  ${zoneDash}
  </header>
  <div class="receipt-body">
  <div class="meta">
    ${metaRow('ทานที่ร้าน', receipt.dineInLabel)}
    ${metaRow('ชื่อพนักงาน', receipt.staffLabel)}
    ${metaRow('เวลาเข้า', receipt.checkedInLabel)}
    ${metaRow('เวลาที่พิมพ์', receipt.printedAtLabel)}
  </div>
  ${zoneDash}
  <table class="items items-list">
    ${itemsColgroup}
    <tr class="items-head">
      <td class="item-name">สินค้า</td>
      <td class="item-qty">Qty</td>
      <td class="item-amt"><span class="amt-val">${amountHeader}</span></td>
    </tr>
    ${itemRows}
  </table>
  ${zoneSpacer}
  <table class="items">
    ${itemsColgroup}
    ${itemGridRow('ยอดรวม', String(receipt.totalQuantity), formatReceiptMoney(receipt.grandTotal), 'subtotal-row')}
  </table>
  ${zoneDash}
  <table class="items">
    ${itemsColgroup}
    ${grandRow('ทั้งหมด', `฿ ${formatReceiptMoney(receipt.grandTotal)}`)}
  </table>
  </div>
  <footer class="receipt-foot">
  <div class="receipt-foot-inner">
  ${footerBlock}
  <div class="powered">Powered by DOD</div>
  </div>
  </footer>
  </div>
  </div>
</body>
</html>`;
    return { html, rasterPx, widthMm, sheetPx, printBottomPadPx, padLeftPx };
  }

  private triggerPrintWhenReady(
    targetWindow: Window,
    widthMm: number,
    rasterPx: number,
    printBottomPadPx: number,
    cleanup?: () => void,
  ): void {
    const captureScale = 2;
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
            scale: captureScale,
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

/** Thermer: thermer://?data= + object {"0":{type,...}} — image type 1 keeps receipt layout. */
function thermerUrlFromEntries(entries: Record<string, ThermerPrintEntry>): string | null {
  const json = JSON.stringify(entries);
  const url = `thermer://?data=${encodeURIComponent(json)}`;
  if (url.length > THERMER_MAX_URL_LEN) return null;
  return url;
}

type ThermerPrintEntry = {
  type: number;
  content?: string;
  bold?: number;
  align?: number;
  format?: number;
  path?: string;
  base64Image?: string;
  value?: string;
  height?: number;
  size?: number;
};

function buildReceiptImagePrintHtml(
  dataUrl: string,
  widthMm: number,
  autoPrint: boolean,
): string {
  const onload = autoPrint
    ? ` onload="setTimeout(function(){window.focus();window.print();},300)"`
    : '';
  return `<!DOCTYPE html>
<html lang="th"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  @page { margin: 0; size: ${widthMm}mm auto; }
  html, body { margin: 0; padding: 0; width: ${widthMm}mm; background: #fff; }
  img { display: block; width: ${widthMm}mm; max-width: 100%; height: auto; margin: 0; }
</style></head>
<body><img src="${dataUrl}" alt="ใบเสร็จ"${onload} /></body></html>`;
}

function buildReceiptZoneDash(widthPx: number): string {
  const dashW = 10;
  const gap = 4;
  const count = Math.ceil(widthPx / (dashW + gap)) + 1;
  const segments = '<span class="zone-dash-seg"></span>'.repeat(count);
  return `<div class="zone-dash" aria-hidden="true">${segments}</div>`;
}

function formatReceiptDateTimeLabel(value: string): string {
  const trimmed = value.trim();
  const m = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}:\d{2})/);
  if (m) {
    return `${m[1]}/${m[2]}/${m[3].slice(-2)} ${m[4]}`;
  }
  return trimmed;
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
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0, scaled.width, scaled.height);
  return scaled;
}
