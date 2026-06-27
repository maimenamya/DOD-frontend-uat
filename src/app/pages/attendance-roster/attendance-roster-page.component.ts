import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { AppModalComponent } from '../../components/app-modal/app-modal.component';
import { AttendanceMonthPickerComponent } from '../../components/attendance-month-picker/attendance-month-picker.component';
import { AttendanceMonthShiftsPanelComponent } from '../../components/attendance-month-shifts-panel/attendance-month-shifts-panel.component';
import { ListPaginatorComponent } from '../../components/list-paginator/list-paginator.component';
import { MasterListToolbarComponent } from '../../components/master-list-toolbar/master-list-toolbar.component';
import type { AttendanceEmployeeMonthPayload, AttendanceShiftRow } from '../../models/attendance';
import type { MstEmployee } from '../../models/employee';
import type { RoleCategory } from '../../models/role';
import { AttendanceService } from '../../services/attendance.service';
import { AuthService } from '../../services/auth.service';
import { EmployeeService } from '../../services/employee.service';
import { ToastService } from '../../services/toast.service';
import { parseAttendanceMonthValue } from '../../utils/attendance-month.util';
import { attendanceStatusLabel } from '../../utils/employee-status-label.util';
import { roleDisplayNameTh } from '../../utils/employee-team.util';
import {
  MasterListQueryState,
  createMasterListView,
  masterListRowNumber,
} from '../../utils/master-list.util';
import { shopCalendarTodayInput } from '../open-table/open-table-ledger.util';

type RosterCategoryTab = 'STAFF' | 'ENTERTAINER';

@Component({
  selector: 'app-attendance-roster-page',
  imports: [
    AppModalComponent,
    AttendanceMonthPickerComponent,
    AttendanceMonthShiftsPanelComponent,
    MasterListToolbarComponent,
    ListPaginatorComponent,
  ],
  templateUrl: './attendance-roster-page.component.html',
})
export class AttendanceRosterPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly employeeService = inject(EmployeeService);
  private readonly attendance = inject(AttendanceService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly employees = signal<MstEmployee[]>([]);
  readonly categoryTab = signal<RosterCategoryTab>('STAFF');
  readonly listQuery = new MasterListQueryState();

  readonly selectedEmployee = signal<MstEmployee | null>(null);
  readonly monthValue = signal(shopCalendarTodayInput().slice(0, 7));
  readonly monthLoading = signal(false);
  readonly monthPayload = signal<AttendanceEmployeeMonthPayload | null>(null);
  readonly waivingRoundDate = signal<string | null>(null);

  readonly canWaiveDeduction = computed(() => this.auth.canWriteOnPage('manage_employees'));

  readonly filteredEmployees = computed(() => {
    const tab = this.categoryTab();
    return this.employees().filter((employee) => {
      if (employee.role?.name === 'OWNER') return false;
      const category: RoleCategory =
        employee.role?.category ??
        (employee.role?.name?.toUpperCase() === 'PR' ? 'ENTERTAINER' : 'STAFF');
      return category === tab;
    });
  });

  readonly listView = createMasterListView(
    this.filteredEmployees,
    this.listQuery,
    (row) =>
      `${row.employeeId} ${row.nickname} ${row.role ? roleDisplayNameTh(row.role) : ''}`,
  );

  ngOnInit(): void {
    const shopId = this.auth.getShopId();
    if (!shopId) {
      this.loading.set(false);
      return;
    }
    this.employeeService.getEmployeesByShop(shopId).subscribe({
      next: (rows) => {
        this.employees.set(rows.filter((row) => row.status === 'Active'));
        this.loading.set(false);
      },
      error: () => {
        this.toast.showError('โหลดรายชื่อพนักงานไม่สำเร็จ');
        this.loading.set(false);
      },
    });
  }

  setCategoryTab(tab: RosterCategoryTab): void {
    this.categoryTab.set(tab);
    this.listQuery.resetPage();
  }

  rowNumber(index: number): number {
    return masterListRowNumber(this.listView(), index);
  }

  statusLabel(employee: MstEmployee): string {
    return attendanceStatusLabel(employee.attendanceStatus);
  }

  openEmployee(employee: MstEmployee): void {
    this.selectedEmployee.set(employee);
    this.loadMonthDetail();
  }

  closeModal(): void {
    this.selectedEmployee.set(null);
    this.monthPayload.set(null);
  }

  onMonthChange(value: string): void {
    this.monthValue.set(value);
    if (this.selectedEmployee()) {
      this.loadMonthDetail();
    }
  }

  waiveDeduction(shift: AttendanceShiftRow): void {
    const employee = this.selectedEmployee();
    if (!employee || !this.canWaiveDeduction()) return;

    this.waivingRoundDate.set(shift.roundDateIso);
    this.attendance.waiveShiftDeduction(employee.employeeId, shift.roundDateIso).subscribe({
      next: (payload) => {
        this.monthPayload.set(payload);
        this.waivingRoundDate.set(null);
        this.toast.showSuccess('ยอดไม่หักแล้ว');
      },
      error: (err: { error?: { error?: string } }) => {
        this.waivingRoundDate.set(null);
        this.toast.showError(err.error?.error ?? 'ยอดไม่หักไม่สำเร็จ');
      },
    });
  }

  revokeWaiver(shift: AttendanceShiftRow): void {
    const employee = this.selectedEmployee();
    if (!employee || !this.canWaiveDeduction()) return;

    this.waivingRoundDate.set(shift.roundDateIso);
    this.attendance.revokeShiftDeductionWaiver(employee.employeeId, shift.roundDateIso).subscribe({
      next: (payload) => {
        this.monthPayload.set(payload);
        this.waivingRoundDate.set(null);
        this.toast.showSuccess('ยกเลิกแล้ว');
      },
      error: (err: { error?: { error?: string } }) => {
        this.waivingRoundDate.set(null);
        this.toast.showError(err.error?.error ?? 'ยกเลิกไม่สำเร็จ');
      },
    });
  }

  private loadMonthDetail(): void {
    const employee = this.selectedEmployee();
    const parsed = parseAttendanceMonthValue(this.monthValue());
    if (!employee || !parsed) return;

    const { year, month } = parsed;
    this.monthLoading.set(true);
    this.monthPayload.set(null);

    this.attendance.getEmployeeMonth(employee.employeeId, year, month).subscribe({
      next: (payload) => {
        this.monthPayload.set(payload);
        this.monthLoading.set(false);
      },
      error: () => {
        this.toast.showError('โหลดบันทึกเวลาเข้างานไม่สำเร็จ');
        this.monthLoading.set(false);
      },
    });
  }
}
