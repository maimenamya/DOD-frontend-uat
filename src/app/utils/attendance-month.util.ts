export const ATTENDANCE_THAI_MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
] as const;

export function attendanceMonthOptions() {
  return ATTENDANCE_THAI_MONTHS.map((label, index) => ({
    value: index + 1,
    label,
  }));
}

export function attendanceYearOptions(currentYear: number, span = 2) {
  const years: Array<{ value: number; label: string }> = [];
  for (let year = currentYear - span; year <= currentYear + 1; year += 1) {
    years.push({ value: year, label: String(year + 543) });
  }
  return years;
}

export function parseAttendanceMonthValue(monthValue: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(monthValue.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }
  return { year, month };
}

export function formatAttendanceMonthValue(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}
