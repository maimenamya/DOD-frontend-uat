import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { finalize, forkJoin, of } from 'rxjs';
import { FormsModule } from '@angular/forms';

import {
  CustomDropdownComponent,
  type DropdownOption,
} from '../../components/custom-dropdown/custom-dropdown.component';
import { ShopDateInputComponent } from '../../components/shop-date-input/shop-date-input.component';
import type {
  DashboardBillStatus,
  DashboardPreset,
  DashboardSummary,
  EmployeePerformanceRank,
} from '../../models/dashboard';
import type { MstEmployee } from '../../models/employee';
import { AuthService } from '../../services/auth.service';
import { DashboardService } from '../../services/dashboard.service';
import { EmployeeService } from '../../services/employee.service';
import { roleLabelThai } from '../../utils/employee-team.util';
import {
  isValidShopDateInput,
  shopCalendarTodayInput,
} from '../open-table/open-table-ledger.util';

function shopCalendarMonthStartInput(): string {
  const today = shopCalendarTodayInput();
  return `${today.slice(0, 7)}-01`;
}

@Component({
  selector: 'app-dashboard-page',
  imports: [DecimalPipe, FormsModule, CustomDropdownComponent, ShopDateInputComponent],
  templateUrl: './dashboard-page.component.html',
})
export class DashboardPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly dashboardService = inject(DashboardService);
  private readonly employeeService = inject(EmployeeService);

  readonly displayNickname = computed(() => this.auth.getDisplayNickname());
  readonly isSaleRole = computed(() => this.auth.isSaleTeamRole());
  readonly isPrRole = computed(() => this.auth.isEntertainerRole());
  readonly canPickBillSale = computed(
    () => this.auth.canAccessTeamManagement() || this.auth.isOwner(),
  );
  /** Manager / OWNER — full shop stats + bill picker. */
  readonly isManagerView = computed(() => this.canPickBillSale());
  /** SALE — shop-wide cards/tables; top bar = own bill total. */
  readonly isSaleTeamView = computed(() => this.isSaleRole() && !this.canPickBillSale());
  /** PR — one PR total card + PR table; top bar = own drink count. */
  readonly isPrTeamView = computed(() => this.isPrRole() && !this.canPickBillSale());
  readonly showTripleStatCards = computed(
    () => this.isManagerView() || this.isSaleTeamView(),
  );
  readonly showStaffRanking = computed(
    () => this.isManagerView() || this.isSaleTeamView(),
  );
  readonly showEntertainerRanking = computed(
    () => this.isManagerView() || this.isSaleTeamView() || this.isPrTeamView(),
  );

  readonly loading = signal(true);
  readonly billLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly summary = signal<DashboardSummary | null>(null);
  readonly billStatus = signal<DashboardBillStatus | null>(null);
  readonly saleStaff = signal<MstEmployee[]>([]);

  readonly datePreset = signal<DashboardPreset>('today');
  readonly customFrom = signal('');
  readonly customTo = signal('');
  readonly staffSearch = signal('');
  readonly entertainerSearch = signal('');
  readonly selectedSaleEmployeeId = signal('');
  private billStatusRequestSeq = 0;

  readonly billSectionTitle = computed(() => {
    if (this.canPickBillSale()) {
      return 'ดูยอดบิลพนักงาน (SALE)';
    }
    if (this.isSaleRole()) {
      return 'ยอดบิลของตัวเอง';
    }
    if (this.isPrRole()) {
      return 'ยอดดื่มของตัวเอง';
    }
    return 'ยอดบิลของตัวเอง';
  });

  readonly saleBillDropdownOptions = computed((): DropdownOption[] =>
    this.saleStaff().map((emp) => ({
      value: emp.employeeId,
      label: emp.nickname,
    })),
  );

  readonly filteredTopStaff = computed(() =>
    this.filterLeaderboard(this.summary()?.topStaff ?? [], this.staffSearch()),
  );

  readonly filteredTopEntertainers = computed(() =>
    this.filterLeaderboard(this.summary()?.topEntertainers ?? [], this.entertainerSearch()),
  );

  ngOnInit(): void {
    if (this.canPickBillSale()) {
      this.loadSaleStaff();
    } else {
      this.loadSummary();
    }
  }

  selectPreset(preset: DashboardPreset): void {
    this.datePreset.set(preset);
    if (preset === 'custom') {
      this.ensureCustomRangeDefaults();
      return;
    }
    this.loadSummary();
  }

  private ensureCustomRangeDefaults(): void {
    const today = shopCalendarTodayInput();
    if (!isValidShopDateInput(this.customFrom())) {
      this.customFrom.set(shopCalendarMonthStartInput());
    }
    if (!isValidShopDateInput(this.customTo())) {
      this.customTo.set(today);
    }
  }

  applyCustomRange(): void {
    if (!this.customFrom() || !this.customTo()) {
      return;
    }
    this.datePreset.set('custom');
    this.loadSummary();
  }

  onSaleEmployeeChange(employeeId: string): void {
    this.selectedSaleEmployeeId.set(employeeId);
    this.loadBillStatus();
  }

  rankDisplayName(row: EmployeePerformanceRank): string {
    return `${row.nickname} (${roleLabelThai(row.role)})`;
  }

  billAmountDisplay(): string {
    const status = this.billStatus();
    if (status) {
      if (status.kind === 'bill_amount') {
        return `฿${status.value.toLocaleString('th-TH', { maximumFractionDigits: 0 })}`;
      }
      return `${status.value.toLocaleString('th-TH')} ดื่ม`;
    }
    if (this.isPrRole() && !this.canPickBillSale()) {
      return '0 ดื่ม';
    }
    return '฿0';
  }

  loadSummary(): void {
    const shopId = this.auth.getShopId();
    if (shopId == null) {
      this.error.set('ไม่พบข้อมูลร้าน กรุณาเข้าสู่ระบบใหม่');
      this.loading.set(false);
      return;
    }

    const preset = this.datePreset();
    if (preset === 'custom' && (!this.customFrom() || !this.customTo())) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.billStatus.set(null);

    const dateParams = {
      shopId,
      preset,
      from: preset === 'custom' ? this.customFrom() : undefined,
      to: preset === 'custom' ? this.customTo() : undefined,
    };

    const billEmployeeId = this.canPickBillSale()
      ? this.selectedSaleEmployeeId().trim()
      : undefined;

    const bill$ =
      this.canPickBillSale() && billEmployeeId
        ? this.dashboardService.getBillStatus({ ...dateParams, billEmployeeId })
        : of(null);

    forkJoin({
      summary: this.dashboardService.getSummary(dateParams),
      bill: bill$,
    }).subscribe({
      next: ({ summary, bill }) => {
        this.summary.set(summary);
        if (this.canPickBillSale()) {
          this.billStatus.set(bill);
        } else {
          this.billStatus.set(summary.billStatus);
        }
        this.loading.set(false);
      },
      error: () => {
        this.error.set('ไม่สามารถโหลดข้อมูล Dashboard ได้');
        this.loading.set(false);
      },
    });
  }

  loadBillStatus(): void {
    const shopId = this.auth.getShopId();
    if (shopId == null) {
      return;
    }

    const preset = this.datePreset();
    if (preset === 'custom' && (!this.customFrom() || !this.customTo())) {
      return;
    }

    const billEmployeeId = this.canPickBillSale()
      ? this.selectedSaleEmployeeId().trim()
      : undefined;
    if (this.canPickBillSale() && !billEmployeeId) {
      this.billStatus.set(null);
      return;
    }

    const requestSeq = ++this.billStatusRequestSeq;
    this.billLoading.set(true);

    this.dashboardService
      .getBillStatus({
        shopId,
        preset,
        from: preset === 'custom' ? this.customFrom() : undefined,
        to: preset === 'custom' ? this.customTo() : undefined,
        billEmployeeId,
      })
      .pipe(finalize(() => {
        if (requestSeq === this.billStatusRequestSeq) {
          this.billLoading.set(false);
        }
      }))
      .subscribe({
        next: (status) => {
          if (requestSeq !== this.billStatusRequestSeq) {
            return;
          }
          this.billStatus.set(status);
        },
        error: () => {
          if (requestSeq !== this.billStatusRequestSeq) {
            return;
          }
          this.billStatus.set(null);
        },
      });
  }

  private loadSaleStaff(): void {
    const shopId = this.auth.getShopId();
    if (shopId == null) {
      this.loadSummary();
      return;
    }

    this.employeeService.getEmployeesByShop(shopId).subscribe({
      next: (employees) => {
        const sales = employees.filter(
          (e) => e.status === 'Active' && e.role?.name === 'SALE',
        );
        this.saleStaff.set(sales);
        if (!this.selectedSaleEmployeeId() && sales.length > 0) {
          this.selectedSaleEmployeeId.set(sales[0].employeeId);
        }
        this.loadSummary();
      },
      error: () => {
        this.loadSummary();
      },
    });
  }

  private filterLeaderboard(
    rows: EmployeePerformanceRank[],
    query: string,
  ): EmployeePerformanceRank[] {
    const term = query.trim().toLowerCase();
    if (!term) {
      return rows;
    }
    return rows.filter((row) => row.nickname.toLowerCase().includes(term));
  }
}
