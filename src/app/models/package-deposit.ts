export type PackageDepositSourceType = 'MEMBERSHIP' | 'PROMOTION';
export type PackageDepositStatus = 'OPEN' | 'CLOSED';

export interface PackageDepositRecord {
  id: number;
  sourceType: PackageDepositSourceType;
  sourceId: number;
  packageName: string;
  customerCode: string | null;
  customerName: string;
  displayLabel: string;
  openedOnLabel: string;
  bottlesTotal: number;
  bottlesRemaining: number;
  remainderNote: string | null;
  status: PackageDepositStatus;
  canDeposit: boolean;
  canClose: boolean;
  canDelete: boolean;
  bottlesLabel: string;
  /** โต๊ะที่เปิดอยู่ที่ถือรายการฝากนี้ (null = ยังไม่อยู่โต๊ะไหน) */
  onOpenSessionId: number | null;
}

export interface PackageDepositCancelPayload {
  note: string;
}

export type PackageOpenMode = 'NEW' | 'DEPOSIT';

export interface PackageDepositPayload {
  quantity: number;
  remainderNote?: string | null;
}
