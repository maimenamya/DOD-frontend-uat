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

    // auto on mobile — Android: RawBT; iPhone/iPad: Thermer (thermer://).
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
    const url = buildThermerPrintUrl(receipt);
    if (!url) {
      return {
        ok: false,
        method: 'thermer',
        message: 'สร้างข้อมูลใบเสร็จสำหรับ Thermer ไม่ได้',
      };
    }
    if (this.navigatePrintUrl(url)) {
      return {
        ok: true,
        method: 'thermer',
        message: 'ส่งไป Thermer แล้ว — กดพิมพ์ในแอป (ครั้งแรกต้องจับคู่ Bluetooth)',
      };
    }
    return {
      ok: false,
      method: 'thermer',
      message: 'ส่งไป Thermer ไม่ได้ — ติดตั้งแอป Thermer แล้วลองอีกครั้ง',
    };
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
    const built = this.buildReceiptPrintDocument(receipt);
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

  /** iOS/Android — preview + print on second tap (keeps user gesture for window.print). */
  private showMobileReceiptPrintSheet(receipt: BillReceiptResponse['receipt']): boolean {
    try {
      document.getElementById('dod-receipt-print-overlay')?.remove();

      const widthMm = receipt.paperWidthMm >= 80 ? 80 : 58;
      const pngBase64 = receipt.receiptPngBase64?.replace(/\s/g, '') ?? '';
      const dataUrl = pngBase64 ? `data:image/png;base64,${pngBase64}` : null;

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
      if (dataUrl) {
        img.src = dataUrl;
      } else {
        img.style.minHeight = '120px';
        title.textContent = 'ใบเสร็จ — กดพิมพ์เพื่อสร้างภาพ';
      }
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
            const url =
              dataUrl ?? (await this.renderReceiptDataUrlForMobile(receipt));
            if (!url) {
              printBtn.disabled = false;
              printBtn.textContent = 'พิมพ์';
              return;
            }
            if (!dataUrl) {
              img.src = url;
            }
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
    const padRightPx = narrow ? 28 : 16;
    const padBottomPx = narrow ? 28 : 18;
    const printBottomPadPx = narrow ? 20 : 14;
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
    const bodyFont = narrow ? '22px' : '23px';
    const headFont = narrow ? '28px' : '29px';
    const grandFont = narrow ? '26px' : '27px';
    const footFont = narrow ? '18px' : '16px';
    const infoFont = narrow ? '17px' : '18px';
    const amtPadRightPx = narrow ? 12 : 10;
    const grandAmtPadRightPx = narrow ? 20 : 14;
    const colQtyPx = narrow ? 30 : 48;
    const colAmtPx = narrow ? 132 : 164;
    const colNamePx = sheetPx - colQtyPx - colAmtPx;

    const itemsColgroup = `<colgroup>
      <col style="width:${colNamePx}px" />
      <col style="width:${colQtyPx}px" />
      <col style="width:${colAmtPx}px" />
    </colgroup>`;

    const amtCell = (value: string) =>
      `<td class="item-amt"><span class="amt-val">${value}</span></td>`;

    const infoRow = (label: string, value: string) =>
      `<tr class="info-row"><td class="item-name info-label">${escapeHtml(label)}</td><td class="item-qty"></td>${amtCell(escapeHtml(formatReceiptDateTimeLabel(value)))}</tr>`;

    const itemGridRow = (label: string, qty: string, amount: string, rowClass = '') => {
      const cls = rowClass ? ` class="${rowClass}"` : '';
      const qtyCell = `<td class="item-qty">${escapeHtml(qty)}</td>`;
      return `<tr${cls}><td class="item-name">${escapeHtml(label)}</td>${qtyCell}${amtCell(escapeHtml(amount))}</tr>`;
    };

    const grandRow = (label: string, amount: string) =>
      itemGridRow(label, '', amount, 'grand-row');

    const zoneDash = buildReceiptZoneDash(sheetPx);

    const itemRows = receipt.lines
      .map((line) => {
        const name = escapeHtml(truncateReceiptName(receiptLineDisplayName(line.name), nameMax));
        const qty = escapeHtml(String(line.quantity));
        const amount = escapeHtml(formatReceiptMoney(line.lineTotal));
        return `<tr><td class="item-name">${name}</td><td class="item-qty">${qty}</td>${amtCell(amount)}</tr>`;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <title>ใบเสร็จ ${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet" />
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
      line-height: 1.25;
      padding: 0;
      color: #000;
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
    .receipt-body { width: 100%; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .items td {
      font-size: ${bodyFont};
      font-weight: 400;
      color: #000;
    }
    .info-label {
      white-space: nowrap;
      font-weight: 400;
    }
    .items .item-name {
      word-break: break-word;
      overflow-wrap: anywhere;
      padding: 1px 4px 1px 4px;
      vertical-align: top;
    }
    .items .item-qty {
      text-align: center;
      padding: 1px 2px;
      vertical-align: top;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .items .item-amt {
      padding: 0;
      vertical-align: top;
      width: ${colAmtPx}px;
      max-width: ${colAmtPx}px;
    }
    .amt-val {
      display: block;
      width: 100%;
      box-sizing: border-box;
      text-align: right;
      padding: 1px ${amtPadRightPx}px 1px 0;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    tr.info-row .amt-val {
      font-size: ${infoFont};
    }
    .items-head { font-weight: 700; }
    .items-head td { font-weight: 700; }
    .zone-dash {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 4px;
      width: 100%;
      margin: 10px 0;
      overflow: hidden;
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
      font-weight: 700;
      padding-top: 4px;
      padding-bottom: 4px;
    }
    tr.grand-row .amt-val {
      font-size: ${grandFont};
      font-weight: 700;
      padding: 4px ${grandAmtPadRightPx}px 4px 0;
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
  <table class="items">
    ${itemsColgroup}
    ${infoRow('ทานที่ร้าน', receipt.dineInLabel)}
    ${infoRow('ชื่อพนักงาน', receipt.staffLabel)}
    ${infoRow('เวลาเข้า', receipt.checkedInLabel)}
    ${infoRow('เวลาที่พิมพ์', receipt.printedAtLabel)}
  </table>
  ${zoneDash}
  <table class="items">
    ${itemsColgroup}
    <tr class="items-head">
      <td class="item-name">สินค้า</td>
      <td class="item-qty">Qty</td>
      <td class="item-amt"><span class="amt-val">${amountHeader}</span></td>
    </tr>
    ${itemRows}
  </table>
  ${zoneDash}
  <table class="items">
    ${itemsColgroup}
    ${itemGridRow('ยอดรวม', String(receipt.totalQuantity), formatReceiptMoney(receipt.grandTotal), 'subtotal-row')}
  </table>
  ${zoneDash}
  <table class="items">
    ${itemsColgroup}
    ${grandRow('ทั้งหมด', `฿${formatReceiptMoney(receipt.grandTotal)}`)}
  </table>
  ${zoneDash}
  </div>
  <footer class="receipt-foot">
  ${footerBlock}
  <div class="powered">Powered by DOD</div>
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

function buildThermerPrintUrl(receipt: BillReceiptResponse['receipt']): string | null {
  const lines = receipt.textLines ?? [];
  const content = lines.join('\n').trim();
  if (!content) return null;

  const entries: ThermerTextEntry[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      entries.push({ type: 0, content: ' ', bold: 0, align: 0, format: 0 });
      continue;
    }
    const centered = line.length > trimmed.length + 2 && /^\s+\S/.test(line);
    const isGrand = trimmed.startsWith('ทั้งหมด');
    const isHead = trimmed === 'บิล' || trimmed === receipt.shopName.trim();
    entries.push({
      type: 0,
      content: trimmed,
      bold: isGrand || isHead ? 1 : 0,
      align: centered ? 1 : 0,
      format: isGrand ? 2 : 0,
    });
  }

  const json = JSON.stringify(entries);
  const encoded = encodeURIComponent(json);
  const url = `thermer://${encoded}`;
  if (url.length > 120_000) return null;
  return url;
}

type ThermerTextEntry = {
  type: 0;
  content: string;
  bold: 0 | 1;
  align: 0 | 1 | 2;
  format: 0 | 1 | 2 | 3 | 4;
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
