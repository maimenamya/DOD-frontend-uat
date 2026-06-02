export type ReportPreset = 'daily' | 'weekly' | 'monthly' | 'custom';

export type ReportSection = 'bills' | 'drinks' | 'expenses';

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
    available: false;
    message: string;
    totalAmount: number;
    rows: [];
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
}
