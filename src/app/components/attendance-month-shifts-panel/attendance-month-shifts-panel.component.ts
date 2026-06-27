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
  readonly waivingRoundDate = input<string | null>(null);

  readonly waiveDeduction = output<AttendanceShiftRow>();
  readonly revokeWaiver = output<AttendanceShiftRow>();

  canWaive(shift: AttendanceShiftRow): boolean {
    return shift.rawDeductionBaht > 0 && !shift.deductionWaived;
  }

  canRevoke(shift: AttendanceShiftRow): boolean {
    return shift.deductionWaived;
  }

  isWaiving(shift: AttendanceShiftRow): boolean {
    return this.waivingRoundDate() === shift.roundDateIso;
  }
}
