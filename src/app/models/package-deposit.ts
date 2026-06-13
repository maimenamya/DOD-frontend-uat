export type PackageDepositSourceType = 'MEMBERSHIP' | 'PROMOTION';

export interface PackageDepositRecord {
  id: number;
  sourceType: PackageDepositSourceType;
  sourceId: number;
  packageName: string;
  customerName: string;
  openedOnLabel: string;
}

export type PackageOpenMode = 'NEW' | 'DEPOSIT';
