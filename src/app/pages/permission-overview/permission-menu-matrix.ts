import type { PermissionGroup } from '../../models/permission-group';
import { PERMISSION_GROUPS } from '../../models/permission-group';

/** Keep in sync with sidebar visibility (`sidebar.component` + `hasFeature`). */
export type MenuAccess = true | false | 'sale' | 'station';

export type PermissionMenuRow = {
  label: string;
  access: Record<PermissionGroup, MenuAccess>;
};

export type PermissionMenuSection = {
  title: string;
  rows: PermissionMenuRow[];
};

const OPS: Record<PermissionGroup, MenuAccess> = {
  OWNER: true,
  MANAGER: true,
  CASHIER: true,
  EMPLOYEE: false,
};

const MGMT: Record<PermissionGroup, MenuAccess> = {
  OWNER: true,
  MANAGER: true,
  CASHIER: false,
  EMPLOYEE: false,
};

const ALL: Record<PermissionGroup, MenuAccess> = {
  OWNER: true,
  MANAGER: true,
  CASHIER: true,
  EMPLOYEE: true,
};

const NONE_OPS: Record<PermissionGroup, MenuAccess> = {
  OWNER: false,
  MANAGER: false,
  CASHIER: false,
  EMPLOYEE: false,
};

export const PERMISSION_MENU_SECTIONS: PermissionMenuSection[] = [
  {
    title: 'งานประจำคืน',
    rows: [
      { label: 'ภาพรวม', access: ALL },
      { label: 'ลงเวลา', access: ALL },
      {
        label: 'บิลของฉัน',
        access: { ...NONE_OPS, EMPLOYEE: 'sale' },
      },
      { label: 'POS', access: OPS },
      {
        label: 'ออเดอร์',
        access: { ...NONE_OPS, EMPLOYEE: 'station' },
      },
      { label: 'ฝาก', access: OPS },
      { label: 'จัดการ tag', access: OPS },
      { label: 'จ่ายค่าดื่ม PR', access: OPS },
      { label: 'บิลย้อนหลัง', access: OPS },
      { label: 'รายงาน', access: OPS },
      { label: 'บันทึกค่าใช้จ่าย', access: OPS },
      { label: 'คู่มือใช้งาน', access: ALL },
    ],
  },
  {
    title: 'การจัดการ',
    rows: [
      { label: 'พนักงาน', access: MGMT },
      { label: 'ตำแหน่ง', access: MGMT },
      { label: 'สิทธิ์ (หน้านี้)', access: MGMT },
      { label: 'บันทึกเวลาเข้างาน', access: MGMT },
      { label: 'เครื่องดื่ม / ประเภท / ค็อกเทล', access: MGMT },
      { label: 'อาหาร / ประเภทอาหาร', access: MGMT },
      { label: 'โซนที่นั่ง / ประเภท / ผังโต๊ะ', access: MGMT },
      { label: 'โปรโมชั่น / เมมเบอร์', access: MGMT },
      { label: 'แพ็กเกจแท็ก PR', access: MGMT },
      { label: 'เบ็ดเตล็ด / ค่าเปิดโต๊ะ', access: MGMT },
      { label: 'สต็อกเครื่องดื่ม', access: MGMT },
      { label: 'กฎร้าน / เครื่องพิมพ์ใบเสร็จ', access: MGMT },
    ],
  },
];

export const PERMISSION_MATRIX_GROUPS = PERMISSION_GROUPS;

export function menuAccessLabel(access: MenuAccess): string {
  if (access === true) return 'เห็น';
  if (access === 'sale' || access === 'station') return 'ตามหน้าที่';
  return 'ไม่เห็น';
}
