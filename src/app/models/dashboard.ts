export interface EmployeePerformanceRank {
  employeeId: string;
  nickname: string;
  role: string;
  totalDrinks: number;
  transactionCount: number;
}

export type DashboardPreset = 'today' | '7d' | '30d' | 'custom';

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
  topStaff: EmployeePerformanceRank[];
  topEntertainers: EmployeePerformanceRank[];
  billStatus: DashboardBillStatus | null;
}

export interface DashboardSummaryParams {
  shopId: number;
  preset?: DashboardPreset;
  from?: string;
  to?: string;
}
