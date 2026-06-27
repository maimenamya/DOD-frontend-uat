import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AppModalComponent } from '../../components/app-modal/app-modal.component';
import { ListPaginatorComponent } from '../../components/list-paginator/list-paginator.component';
import { MasterListToolbarComponent } from '../../components/master-list-toolbar/master-list-toolbar.component';
import type { AttendanceEmployeeMonthPayload } from '../../models/attendance';
import type { MstEmployee } from '../../models/employee';
import type { RoleCategory } from '../../models/role';
import { AttendanceService } from '../../services/attendance.service';
import { AuthService } from '../../services/auth.service';
import { EmployeeService } from '../../services/employee.service';
import { ToastService } from '../../services/toast.service';
import { attendanceKioskUrl } from '../../utils/attendance-kiosk-url.util';
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
    FormsModule,
    AppModalComponent,
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

  readonly branchKiosks = computed(() => {
    this.auth.session();
    const branches = this.auth.getAvailableBranches();
    const mapped = branches
      .map((branch) => {
        const publicId = branch.publicId?.trim();
        if (!publicId) return null;
        return {
          shopId: branch.shopId,
          branchName: branch.branchName,
          branchCode: branch.branchCode,
          url: attendanceKioskUrl(publicId),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);

    if (mapped.length > 0) {
      return mapped;
    }

    const publicId = this.auth.getShopPublicId();
    if (!publicId) return [];
    return [
      {
        shopId: this.auth.getShopId() ?? 0,
        branchName: this.auth.getShopDisplayName(),
        branchCode: '',
        url: attendanceKioskUrl(publicId),
      },
    ];
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

  readonly monthLabel = computed(() => {
    const value = this.monthValue();
    const match = /^(\d{4})-(\d{2})$/.exec(value);
    if (!match) return value;
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month < 1 || month > 12) return value;
    return `${THAI_MONTHS[month - 1]} ${year + 543}`;
  });

  ngOnInit(): void {
    if (this.auth.getAvailableBranches().length === 0) {
      this.auth.fetchAccessibleBranches().subscribe({
        error: () => {
          // ใช้สาขาจาก session เป็นทางเลือกสำรอง
        },
      });
    }

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

  copyKioskUrl(url: string): void {
    if (!url) {
      this.toast.showError('ไม่พบลิงก์ร้านสำหรับจุดลงเวลา');
      return;
    }
    void navigator.clipboard.writeText(url).then(
      () => this.toast.showSuccess('คัดลอกลิงก์จุดลงเวลาแล้ว'),
      () => this.toast.showError('คัดลอกลิงก์ไม่สำเร็จ'),
    );
  }
}
