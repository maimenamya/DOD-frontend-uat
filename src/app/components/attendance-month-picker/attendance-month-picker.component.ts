import { Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  CustomDropdownComponent,
  type DropdownOption,
} from '../custom-dropdown/custom-dropdown.component';
import {
  attendanceMonthOptions,
  attendanceYearOptions,
  formatAttendanceMonthValue,
  parseAttendanceMonthValue,
} from '../../utils/attendance-month.util';
import { shopCalendarTodayInput } from '../../pages/open-table/open-table-ledger.util';

@Component({
  selector: 'app-attendance-month-picker',
  imports: [FormsModule, CustomDropdownComponent],
  templateUrl: './attendance-month-picker.component.html',
})
export class AttendanceMonthPickerComponent {
  readonly monthValue = input.required<string>();

  readonly monthChange = output<string>();

  readonly monthOptions: DropdownOption[] = attendanceMonthOptions();

  readonly yearOptions = computed((): DropdownOption[] => {
    const currentYear = Number(shopCalendarTodayInput().slice(0, 4));
    return attendanceYearOptions(currentYear);
  });

  readonly pickerMonth = computed(() => parseAttendanceMonthValue(this.monthValue())?.month ?? 1);

  readonly pickerYear = computed(() => {
    const parsed = parseAttendanceMonthValue(this.monthValue());
    return parsed?.year ?? Number(shopCalendarTodayInput().slice(0, 4));
  });

  onPickerMonth(value: number | string | null): void {
    if (value == null) return;
    const month = Number(value);
    if (!Number.isFinite(month) || month < 1 || month > 12) return;
    this.monthChange.emit(formatAttendanceMonthValue(this.pickerYear(), month));
  }

  onPickerYear(value: number | string | null): void {
    if (value == null) return;
    const year = Number(value);
    if (!Number.isInteger(year)) return;
    this.monthChange.emit(formatAttendanceMonthValue(year, this.pickerMonth()));
  }
}
