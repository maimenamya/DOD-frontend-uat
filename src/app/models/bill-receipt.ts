import type { ReceiptPrintChannel } from './shop-receipt-printer';

export type BillReceiptLine = {
  name: string;
  quantity: number;
  lineTotal: number;
};

export type BillReceiptPayload = {
  billId: number;
  billReference: string;
  shopName: string;
  headerText: string | null;
  footerText: string | null;
  paperWidthMm: number;
  title: string;
  dineInLabel: string;
  staffLabel: string;
  checkedInLabel: string;
  printedAtLabel: string;
  paymentMethodLabel?: string | null;
  lines: BillReceiptLine[];
  totalQuantity: number;
  grandTotal: number;
  textLines: string[];
  printChannel: ReceiptPrintChannel;
  receiptFormat: 'png_raster' | 'text_escpos';
  receiptPngBase64: string;
  escPosBase64: string;
};

export type BillReceiptPrintResult = {
  attempted: boolean;
  ok: boolean;
  mode: ReceiptPrintChannel;
  error?: string;
};

export type BillReceiptResponse = {
  receipt: BillReceiptPayload;
  print: BillReceiptPrintResult;
};
