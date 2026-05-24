export interface EmployeePerformanceRank {
  employeeId: string;
  nickname: string;
  role: string;
  totalAmount: number;
  totalDrinks: number;
  transactionCount: number;
}

export type DashboardPreset = 'today' | '7d' | '30d' | 'custom';

export interface DashboardSummary {
  shopId: number;
  preset: string;
  from: string;
  to: string;
  totalRevenue: number;
  totalSalesDrinks: number;
  totalPrDrinks: number;
  topSales: EmployeePerformanceRank[];
  topPr: EmployeePerformanceRank[];
}

/** @deprecated Use DashboardSummary */
export type DashboardStats = DashboardSummary;

export interface DashboardSummaryParams {
  shopId: number;
  preset?: DashboardPreset;
  from?: string;
  to?: string;
}
