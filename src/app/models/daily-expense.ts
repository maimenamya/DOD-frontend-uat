export type TxnDailyExpense = {
  id: number;
  description: string;
  amount: number;
  businessDate: string;
  businessDateLabel: string;
};

export type DailyExpenseListResponse = {
  items: TxnDailyExpense[];
  totalAmount: number;
  fromDate: string;
  toDate: string;
};

export type DailyExpenseWritePayload = {
  description: string;
  amount: number;
  businessDate: string;
};
