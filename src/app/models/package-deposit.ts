/** ฝากเหล้าเมม / โปร — บันทึกยอดคงเหลือข้ามวัน (CRUD ยังไม่เชื่อม API) */
export type PackageDepositSourceType = 'MEMBERSHIP' | 'PROMOTION';

export interface PackageDepositRecord {
  id: number;
  packageSourceType: PackageDepositSourceType;
  packageName: string;
  customerName: string;
  /** วันที่ฝาก (แสดงตามนาฬิกาไทยของร้าน) */
  depositedOnLabel: string;
  bottleCount: number;
  note: string | null;
}
