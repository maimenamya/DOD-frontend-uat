import type { PrTagEnrollmentStatus } from '../models/pr-tag';

export function prTagEnrollmentStatusLabel(status: PrTagEnrollmentStatus): string {
  switch (status) {
    case 'ACTIVE':
      return 'กำลังทำแท็ก';
    case 'COMPLETED':
      return 'สำเร็จ';
    case 'FAILED':
      return 'ไม่ผ่าน';
    case 'CUT_FREELANCE':
      return 'ตกแท็ก / Freelance';
    default:
      return status;
  }
}

export function prTagEnrollmentStatusBadgeClass(status: PrTagEnrollmentStatus): string {
  switch (status) {
    case 'ACTIVE':
      return 'app-badge app-badge-entertainer';
    case 'COMPLETED':
      return 'app-badge app-badge-staff';
    case 'FAILED':
      return 'app-badge app-badge-default';
    case 'CUT_FREELANCE':
      return 'app-badge app-badge-default';
    default:
      return 'app-badge app-badge-default';
  }
}
