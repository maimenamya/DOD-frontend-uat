export type PackageDepositSourceType = 'MEMBERSHIP' | 'PROMOTION';
export type PackageDepositStatus = 'OPEN' | 'CLOSED';

export interface PackageDepositRecord {
  id: number;
  sourceType: PackageDepositSourceType;
  sourceId: number;
  packageName: string;
  customerName: string;
  openedOnLabel: string;
  bottlesTotal: number;
  bottlesRemaining: number;
  remainderNote: string | null;
  status: PackageDepositStatus;
  canDeposit: boolean;
  canClose: boolean;
  bottlesLabel: string;
}

export type PackageOpenMode = 'NEW' | 'DEPOSIT';

export interface PackageDepositPayload {
  quantity: number;
  remainderNote?: string | null;
}
