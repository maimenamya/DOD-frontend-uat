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
