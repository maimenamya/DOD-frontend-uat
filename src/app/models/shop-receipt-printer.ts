/** Matches backend ReceiptPrintModeApi — per-shop receipt print channel. */
export type ReceiptPrintChannel =
  | 'off'
  | 'auto'
  | 'browser_pdf'
  | 'bridging_app'
  | 'thermer'
  | 'wifi_raw';

export interface ShopReceiptPrinterConfig {
  shopId: number;
  printMode: ReceiptPrintChannel;
  printerHost: string | null;
  printerPort: number | null;
  paperWidthMm: number;
  headerText: string | null;
  footerText: string | null;
}

export type ShopReceiptPrinterInput = Omit<ShopReceiptPrinterConfig, 'shopId'>;

export const RECEIPT_PRINT_MODE_OPTIONS: Array<{ value: ReceiptPrintChannel; label: string }> = [
  { value: 'auto', label: 'อัตโนมัติ — PC เบราว์เซอร์ / Android RawBT / iPhone AHAS Print Service' },
  { value: 'browser_pdf', label: 'เบราว์เซอร์ — PC หรือแท็บเล็ต (หน้าต่าง Print)' },
  {
    value: 'bridging_app',
    label: 'แอปตัวกลาง — RawBT (Android) / AHAS Print Service (iPhone)',
  },
  { value: 'wifi_raw', label: 'Wi‑Fi/LAN — เครื่องปริ้นมี IP (port 9100)' },
  { value: 'thermer', label: 'Thermer — ไม่ใช้แล้ว (มีโฆษณา/ลิมิต)' },
  { value: 'off', label: 'ปิด — ไม่พิมพ์อัตโนมัติหลังเช็คบิล' },
];

export const RECEIPT_PAPER_WIDTH_OPTIONS = [
  { value: 58, label: '58 mm (POS58)' },
  { value: 80, label: '80 mm' },
];
