export type ReportPreset = 'daily' | 'weekly' | 'monthly' | 'custom';

export type ReportSection = 'bills' | 'drinks' | 'expenses' | 'sale_breakdown';

export interface ReportOwnerRecipient {
  nickname: string;
  lineUserId: string;
  lineUserIdMasked: string;
}

export interface ReportMeta {
  owner: ReportOwnerRecipient | null;
  ownerLineUserIdMissing: boolean;
  lineConfigured: boolean;
}

export interface ReportBillRow {
  businessDate: string;
  billReference: string;
  saleNickname: string;
  saleEmployeeId: string;
  billAmount: number;
}

export interface ReportBillBySale {
  saleEmployeeId: string;
  nickname: string;
  billCount: number;
  totalAmount: number;
}

export interface ReportDrinkRankRow {
  employeeId: string;
  nickname: string;
  roleName: string;
  team: 'staff' | 'entertainer';
  totalDrinks: number;
  transactionCount: number;
}

export interface ReportExpenseRow {
  businessDate: string;
  description: string;
  amount: number;
}

export interface ReportSaleSummaryRow {
  saleEmployeeId: string;
  nickname: string;
  billCount: number;
  categoryQuantities: Record<string, number>;
  promotionCount: number;
  membershipCount: number;
  entertainerDrinkTotal: number;
}

export interface ReportSaleEntertainerRow {
  saleEmployeeId: string;
  saleNickname: string;
  entertainerEmployeeId: string;
  entertainerNickname: string;
  roleName: string;
  totalDrinks: number;
}

export interface ReportSaleProductRow {
  saleEmployeeId: string;
  saleNickname: string;
  categoryLabel: string;
  itemName: string;
  quantity: number;
  unitLabel: string;
}

export interface ReportPreview {
  shopId: number;
  shopName: string;
  preset: ReportPreset;
  rangeLabel: string;
  fromDate: string;
  toDate: string;
  fromDateIso: string;
  toDateIso: string;
  generatedAtLabel: string;
  owner: ReportOwnerRecipient | null;
  ownerLineUserIdMissing: boolean;
  sections: ReportSection[];
  bills: {
    totalAmount: number;
    billCount: number;
    bySale: ReportBillBySale[];
    rows: ReportBillRow[];
  } | null;
  drinks: {
    totalDrinks: number;
    totalStaffDrinks: number;
    totalEntertainerDrinks: number;
    staff: ReportDrinkRankRow[];
    entertainers: ReportDrinkRankRow[];
  } | null;
  expenses: {
    available: boolean;
    message: string;
    totalAmount: number;
    rows: ReportExpenseRow[];
  } | null;
  saleBreakdown: {
    categoryColumns: string[];
    summaries: ReportSaleSummaryRow[];
    entertainerRows: ReportSaleEntertainerRow[];
    productRows: ReportSaleProductRow[];
  } | null;
}

export interface ReportPreviewParams {
  shopId: number;
  preset?: ReportPreset;
  from?: string;
  to?: string;
  sections?: ReportSection[];
}

export interface SendReportLinePayload extends ReportPreviewParams {
  shopId: number;
}

export interface SendReportLineResult {
  ok: boolean;
  sentTo: string;
  filename?: string;
  downloadLinkSent?: boolean;
}
