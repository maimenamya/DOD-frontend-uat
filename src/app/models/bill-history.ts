export interface BillHistoryRow {
  id: number;
  businessDateLabel: string;
  checkedOutLabel: string;
  billReference: string;
  saleNickname: string;
  dineInLabel: string | null;
  billAmount: number;
  paymentMethodLabel: string;
  hasReceipt: boolean;
}

export interface BillHistoryListResponse {
  fromDate: string;
  toDate: string;
  billCount: number;
  totalAmount: number;
  selfOnly: boolean;
  items: BillHistoryRow[];
}

export interface BillHistoryListParams {
  from: string;
  to: string;
}
