export interface EmployeePerformanceRank {
  employeeId: string;
  name: string;
  nickname: string;
  role: string;
  totalAmount: number;
  totalDrinks: number;
  transactionCount: number;
}

export interface DashboardStats {
  shopId: number;
  totalSalesAmount: number;
  totalDrinksCount: number;
  topSales: EmployeePerformanceRank[];
  topPr: EmployeePerformanceRank[];
}
