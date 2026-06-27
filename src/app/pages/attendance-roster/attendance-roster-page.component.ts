import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AppModalComponent } from '../../components/app-modal/app-modal.component';
import {
  CustomDropdownComponent,
  type DropdownOption,
} from '../../components/custom-dropdown/custom-dropdown.component';
import { ListPaginatorComponent } from '../../components/list-paginator/list-paginator.component';
import { MasterListToolbarComponent } from '../../components/master-list-toolbar/master-list-toolbar.component';
import type { AttendanceEmployeeMonthPayload } from '../../models/attendance';
import type { MstEmployee } from '../../models/employee';
import type { RoleCategory } from '../../models/role';
import { AttendanceService } from '../../services/attendance.service';
import { AuthService } from '../../services/auth.service';
import { EmployeeService } from '../../services/employee.service';
import { ToastService } from '../../services/toast.service';
import { attendanceStatusLabel } from '../../utils/employee-status-label.util';
import { roleDisplayNameTh } from '../../utils/employee-team.util';
import {
  MasterListQueryState,
  createMasterListView,
  masterListRowNumber,
} from '../../utils/master-list.util';
import { shopCalendarTodayInput } from '../open-table/open-table-ledger.util';

type RosterCategoryTab = 'STAFF' | 'ENTERTAINER';

const THAI_MONTHS = [
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
];

@Component({
  selector: 'app-attendance-roster-page',
  imports: [
    DecimalPipe,
    FormsModule,
    AppModalComponent,
    CustomDropdownComponent,
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

  readonly monthOptions: DropdownOption[] = THAI_MONTHS.map((label, index) => ({
    value: index + 1,
    label,
  }));

  readonly yearOptions = computed((): DropdownOption[] => {
    const currentYear = Number(shopCalendarTodayInput().slice(0, 4));
    const years: DropdownOption[] = [];
    for (let year = currentYear - 2; year <= currentYear + 1; year += 1) {
      years.push({ value: year, label: String(year + 543) });
    }
    return years;
  });

  readonly pickerMonth = computed(() => {
    const match = /^(\d{4})-(\d{2})$/.exec(this.monthValue());
    return match ? Number(match[2]) : 1;
  });

  readonly pickerYear = computed(() => {
    const match = /^(\d{4})-(\d{2})$/.exec(this.monthValue());
    return match ? Number(match[1]) : Number(shopCalendarTodayInput().slice(0, 4));
  });

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

  onPickerMonth(value: number | string | null): void {
    if (value == null) return;
    const month = Number(value);
    if (!Number.isFinite(month) || month < 1 || month > 12) return;
    this.onMonthChange(`${this.pickerYear()}-${String(month).padStart(2, '0')}`);
  }

  onPickerYear(value: number | string | null): void {
    if (value == null) return;
    const year = Number(value);
    if (!Number.isInteger(year)) return;
    this.onMonthChange(`${year}-${String(this.pickerMonth()).padStart(2, '0')}`);
  }

  onMonthChange(value: string): void {
    this.monthValue.set(value);
    if (this.selectedEmployee()) {
      this.loadMonthDetail();
    }
  }

  private loadMonthDetail(): void {
    const employee = this.selectedEmployee();
    const monthValue = this.monthValue().trim();
    const match = /^(\d{4})-(\d{2})$/.exec(monthValue);
    if (!employee || !match) return;

    const year = Number(match[1]);
    const month = Number(match[2]);
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
