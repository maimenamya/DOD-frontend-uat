import type { RoleCategory } from '../models/role';

/** Fallback Thai labels for legacy system role names (before displayNameTh in DB). */
const SYSTEM_ROLE_LABEL_TH: Record<string, string> = {
  OWNER: 'เจ้าของร้าน',
  ADMIN: 'ผู้ดูแลระบบ',
  MANAGER: 'ผู้จัดการ',
  SALE: 'เซลล์',
  PR: 'พีอาร์',
};

export type RoleLike = {
  name: string;
  category?: RoleCategory;
  displayNameTh?: string | null;
};

export function roleDisplayNameEn(role: RoleLike): string {
  return role.name;
}

export function roleDisplayNameTh(role: RoleLike): string {
  const fromDb = role.displayNameTh?.trim();
  if (fromDb) return fromDb;
  return SYSTEM_ROLE_LABEL_TH[role.name.toUpperCase()] ?? role.name;
}

/** Dropdown / sort label: `พีอาร์ (PR)` */
export function roleOptionLabel(role: RoleLike): string {
  const th = roleDisplayNameTh(role);
  const en = roleDisplayNameEn(role);
  if (th === en) return en;
  return `${th} (${en})`;
}

/** Badge CSS: two variants from master category (STAFF vs ENTERTAINER). */
export function roleBadgeClass(role: RoleLike | null | undefined): string {
  if (!role) return 'app-badge app-badge-default';
  if (role.category === 'ENTERTAINER') return 'app-badge app-badge-entertainer';
  if (role.category === 'STAFF') return 'app-badge app-badge-staff';
  return 'app-badge app-badge-default';
}

/** @deprecated Use roleDisplayNameTh(role) with full MstRole from API. */
export function roleLabelThai(roleName: string): string {
  return roleDisplayNameTh({ name: roleName });
}

export function compareRolesByThaiLabel(a: RoleLike, b: RoleLike): number {
  return roleDisplayNameTh(a).localeCompare(roleDisplayNameTh(b), 'th');
}
