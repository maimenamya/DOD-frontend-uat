export type EmployeeTableSeatStatus = 'AVAILABLE' | 'ON_TABLE';
export type EmployeeAttendanceStatus = 'ON_DUTY' | 'OFF_DUTY';

export const TABLE_SEAT_STATUS_LABELS: Record<EmployeeTableSeatStatus, string> = {
  AVAILABLE: 'ว่าง',
  ON_TABLE: 'นั่งโต๊ะ',
};

export const ATTENDANCE_STATUS_LABELS: Record<EmployeeAttendanceStatus, string> = {
  ON_DUTY: 'เข้างาน',
  OFF_DUTY: 'ไม่เข้างาน',
};

export function tableSeatStatusLabel(
  value: EmployeeTableSeatStatus | undefined,
): string {
  if (!value) return '—';
  return TABLE_SEAT_STATUS_LABELS[value] ?? value;
}

export function attendanceStatusLabel(
  value: EmployeeAttendanceStatus | undefined,
): string {
  if (!value) return '—';
  return ATTENDANCE_STATUS_LABELS[value] ?? value;
}
