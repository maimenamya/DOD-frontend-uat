export const PERMISSION_GROUPS = ['OWNER', 'MANAGER', 'CASHIER', 'EMPLOYEE'] as const;

export type PermissionGroup = (typeof PERMISSION_GROUPS)[number];

export const PERMISSION_GROUP_LABEL_TH: Record<PermissionGroup, string> = {
  OWNER: 'เจ้าของร้าน — ทำได้ทุกอย่าง',
  MANAGER: 'ผู้จัดการ — ทุกอย่างยกเว้นแก้ไขเจ้าของร้าน',
  CASHIER: 'แคชเชียร์ — แดชบอร์ด, เปิดโต๊ะ, tag, รายงาน',
  EMPLOYEE:
    'พนักงานหน้างาน — Sale: ยอดตัวเอง + ดื่มเซลล์/PR ร้าน; PR: ยอดตัวเอง + ตาราง PR',
};
