export interface EmployeePerformanceRank {
  employeeId: string;
  nickname: string;
  role: string;
  totalDrinks: number;
  transactionCount: number;
}

export type DashboardPreset = 'today' | 'tonight' | 'yesterday' | 'custom';

export type BillStatusKind = 'bill_amount' | 'drink_count';

export interface DashboardBillStatus {
  employeeId: string;
  nickname: string;
  role: string;
  kind: BillStatusKind;
  value: number;
}

export interface DashboardSummary {
  shopId: number;
  preset: string;
  from: string;
  to: string;
  totalDrinks: number;
  totalStaffDrinks: number;
  totalEntertainerDrinks: number;
  /** ยอดบิลรวมทั้งร้าน — แสดงเฉพาะ OWNER/MANAGER */
  totalShopBillAmount: number;
  topStaff: EmployeePerformanceRank[];
  topEntertainers: EmployeePerformanceRank[];
  billStatus: DashboardBillStatus | null;
}

/** Synthetic id for creditSaleToShop bills in the sale bill picker. */
export const DASHBOARD_SHOP_BILL_BUCKET_ID = '__SHOP__';

export interface DashboardSummaryParams {
  shopId: number;
  preset?: DashboardPreset;
  from?: string;
  to?: string;
}
