export interface FreelanceDrinkPayoutRow {
  rowKey: string;
  employeeId: string;
  nickname: string;
  roleName: string;
  roleDisplayNameTh: string | null;
  businessDate: string;
  businessDateLabel: string;
  drinksCount: number;
  employeePerDrink: number;
  totalPayoutBaht: number;
  isPaid: boolean;
  payoutId: number | null;
  paidAtLabel: string | null;
}

export interface TagDrinkPayoutRow {
  enrollmentId: number;
  employeeId: string;
  nickname: string;
  roleName: string;
  roleDisplayNameTh: string | null;
  tagName: string;
  businessDate: string;
  businessDateLabel: string;
  workingDaysCount: number;
  requiredWorkingDays: number;
  accumulatedDrinks: number;
  targetDrinks: number;
  guaranteeAmountBaht: number;
  overQuotaDrinks: number;
  overQuotaAmountBaht: number;
  employeePerDrink: number;
  totalPayoutBaht: number;
  endedAtLabel: string | null;
  isPaid: boolean;
  payoutId: number | null;
  paidAtLabel: string | null;
}

export interface DrinkPayoutDashboard {
  freelanceRows: FreelanceDrinkPayoutRow[];
  tagRows: TagDrinkPayoutRow[];
  drinkShopPortionBaht: number;
  fromDate: string;
  toDate: string;
  freelanceUnpaidTotal: number;
  tagUnpaidTotal: number;
}
