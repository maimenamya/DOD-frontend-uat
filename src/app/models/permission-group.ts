export const PERMISSION_GROUPS = ['OWNER', 'MANAGER', 'CASHIER', 'EMPLOYEE'] as const;

export type PermissionGroup = (typeof PERMISSION_GROUPS)[number];

export const PERMISSION_GROUP_LABEL_TH: Record<PermissionGroup, string> = {
  OWNER: 'เจ้าของร้าน — ทำได้ทุกอย่าง',
  MANAGER: 'ผู้จัดการ — ทุกอย่างยกเว้นแก้ไขเจ้าของร้าน',
  CASHIER: 'แคชเชียร์ — งานหน้า (เปิดโต๊ะ/ฝาก/แท็ก/รายงาน/ค่าใช้จ่าย) ไม่รวมการจัดการ',
  EMPLOYEE:
    'พนักงานหน้างาน — Sale: ยอดตัวเอง + ดื่มเซลล์/PR ร้าน; PR: ยอดตัวเอง + ตาราง PR',
};

/** Short labels for dropdowns and tables (no long descriptions). */
export const PERMISSION_GROUP_SHORT_LABEL_TH: Record<PermissionGroup, string> = {
  OWNER: 'เจ้าของร้าน',
  MANAGER: 'ผู้จัดการ',
  CASHIER: 'แคชเชียร์',
  EMPLOYEE: 'พนักงาน',
};
