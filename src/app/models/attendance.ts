export type EmployeeTimePunchType = 'CHECK_IN' | 'CHECK_OUT';

export interface AttendanceKioskPayload {
  shopPublicId: string;
  shopName: string;
  branchCode: string;
  token: string;
  refreshInSeconds: number;
  expiresAtLabel: string;
}

export interface AttendancePunchResult {
  punchType: EmployeeTimePunchType;
  punchTypeLabel: string;
  punchedAtLabel: string;
  attendanceStatus: 'ON_DUTY' | 'OFF_DUTY';
  attendanceStatusLabel: string;
  employeeNickname: string;
  prTagWorkDayRecorded?: boolean;
}

export interface AttendanceMePayload {
  attendanceStatus: 'ON_DUTY' | 'OFF_DUTY';
  attendanceStatusLabel: string;
  todayPunches: Array<{
    punchType: EmployeeTimePunchType;
    punchTypeLabel: string;
    punchedAtLabel: string;
  }>;
}

export interface AttendanceLogRow {
  id: number;
  employeeId: string;
  employeeNickname: string;
  roleDisplayNameTh: string;
  punchType: EmployeeTimePunchType;
  punchTypeLabel: string;
  punchedAtLabel: string;
}

export interface AttendanceLogsResponse {
  items: AttendanceLogRow[];
}

export type AttendanceShiftDayStatus = 'WORKED' | 'NO_RECORD' | 'ABSENT' | 'FUTURE';

export interface AttendanceShiftRow {
  roundDateIso: string;
  roundDateLabel: string;
  checkInLabel: string | null;
  checkOutLabel: string | null;
  expectedCheckInLabel: string | null;
  expectedCheckOutLabel: string | null;
  lateMinutes: number | null;
  rawDeductionBaht: number;
  deductionBaht: number;
  deductionWaived: boolean;
  openShift: boolean;
  autoClosedForgotCheckout: boolean;
  dayStatus: AttendanceShiftDayStatus;
  markedAbsent: boolean;
}

export interface AttendanceEmployeeMonthPayload {
  employeeId: string;
  employeeNickname: string;
  roleDisplayNameTh: string;
  year: number;
  month: number;
  expectedCheckInLabel: string | null;
  expectedCheckOutLabel: string | null;
  shifts: AttendanceShiftRow[];
}
