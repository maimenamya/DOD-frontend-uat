import { DecimalPipe } from '@angular/common';
import { Component, input, output } from '@angular/core';

import type { AttendanceEmployeeMonthPayload, AttendanceShiftRow } from '../../models/attendance';

@Component({
  selector: 'app-attendance-month-shifts-panel',
  imports: [DecimalPipe],
  templateUrl: './attendance-month-shifts-panel.component.html',
})
export class AttendanceMonthShiftsPanelComponent {
  readonly detail = input<AttendanceEmployeeMonthPayload | null>(null);
  readonly loading = input(false);
  readonly showWaiveActions = input(false);
  readonly showAbsentActions = input(false);
  readonly waivingRoundDate = input<string | null>(null);

  readonly openDeductionModal = output<AttendanceShiftRow>();
  readonly revokeDeduction = output<AttendanceShiftRow>();
  readonly markAbsent = output<AttendanceShiftRow>();
  readonly unmarkAbsent = output<AttendanceShiftRow>();

  canSetDeduction(shift: AttendanceShiftRow): boolean {
    if (!this.showWaiveActions()) return false;
    if (shift.dayStatus === 'FUTURE' || shift.dayStatus === 'NO_RECORD') return false;
    if (shift.leaveWithinQuota) return false;
    if (shift.overQuotaAbsent && !shift.deductionAdjusted) return true;
    if (shift.rawDeductionBaht > 0) return true;
    return false;
  }

  canRevokeDeduction(shift: AttendanceShiftRow): boolean {
    return this.showWaiveActions() && shift.deductionAdjusted;
  }

  canMarkAbsent(shift: AttendanceShiftRow): boolean {
    return this.showAbsentActions() && shift.dayStatus === 'NO_RECORD';
  }

  canUnmarkAbsent(shift: AttendanceShiftRow): boolean {
    return this.showAbsentActions() && shift.dayStatus === 'ABSENT';
  }

  isWaiving(shift: AttendanceShiftRow): boolean {
    return this.waivingRoundDate() === shift.roundDateIso;
  }

  deductionDisplay(shift: AttendanceShiftRow): number | null {
    if (shift.deductionAdjusted) return shift.deductionBaht;
    if (shift.overQuotaAbsent) return null;
    if (shift.deductionBaht > 0) return shift.deductionBaht;
    return null;
  }

  rowClass(shift: AttendanceShiftRow): string {
    if (shift.dayStatus === 'FUTURE') return 'text-text-secondary/50';
    if (shift.dayStatus === 'NO_RECORD') return 'text-text-secondary';
    if (shift.dayStatus === 'ABSENT') return 'text-rose-300';
    return '';
  }
}
