import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ShopDateInputComponent } from '../../components/shop-date-input/shop-date-input.component';
import type { DashboardPreset } from '../../models/dashboard';
import type { FreelanceDrinkPayoutRow, TagDrinkPayoutRow } from '../../models/drink-payout';
import { AuthService } from '../../services/auth.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import {
  DrinkPayoutService,
  type DrinkPayoutDateParams,
} from '../../services/drink-payout.service';
import { ToastService } from '../../services/toast.service';
import { roleOptionLabel } from '../../utils/role-display.util';
import {
  isValidShopDateInput,
  shopCalendarTodayInput,
} from '../open-table/open-table-ledger.util';

function shopCalendarMonthStartInput(): string {
  const today = shopCalendarTodayInput();
  return `${today.slice(0, 7)}-01`;
}

@Component({
  selector: 'app-drink-payout-page',
  imports: [DecimalPipe, FormsModule, ShopDateInputComponent],
  templateUrl: './drink-payout-page.component.html',
})
export class DrinkPayoutPageComponent implements OnInit {
  private readonly drinkPayoutService = inject(DrinkPayoutService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly canPay = computed(() => this.auth.canWriteOnPage('drink_payout'));
  readonly datePreset = signal<DashboardPreset>('today');
  readonly customFrom = signal('');
  readonly customTo = signal('');
  readonly rangeLabelFrom = signal('');
  readonly rangeLabelTo = signal('');

  readonly freelanceRows = signal<FreelanceDrinkPayoutRow[]>([]);
  readonly tagRows = signal<TagDrinkPayoutRow[]>([]);
  readonly freelanceUnpaidTotal = signal(0);
  readonly tagUnpaidTotal = signal(0);

  readonly loading = signal(true);
  readonly acting = signal(false);

  ngOnInit(): void {
    if (this.datePreset() === 'custom') {
      this.ensureCustomRangeDefaults();
    }
    this.loadDashboard();
  }

  roleLabel(row: { roleName: string; roleDisplayNameTh: string | null }): string {
    return roleOptionLabel({ name: row.roleName, displayNameTh: row.roleDisplayNameTh });
  }

  selectPreset(preset: DashboardPreset): void {
    this.datePreset.set(preset);
    if (preset === 'custom') {
      this.ensureCustomRangeDefaults();
      return;
    }
    this.loadDashboard();
  }

  applyCustomRange(): void {
    const from = this.customFrom().trim();
    const to = this.customTo().trim();
    if (!isValidShopDateInput(from) || !isValidShopDateInput(to)) {
      this.toast.showError('กรุณาเลือกช่วงวันที่');
      return;
    }
    if (from > to) {
      this.toast.showError('วันเริ่มต้องไม่หลังวันสิ้นสุด');
      return;
    }
    this.loadDashboard();
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

  private currentDateParams(): DrinkPayoutDateParams {
    const preset = this.datePreset();
    return {
      preset,
      from: preset === 'custom' ? this.customFrom() : undefined,
      to: preset === 'custom' ? this.customTo() : undefined,
    };
  }

  loadDashboard(): void {
    const preset = this.datePreset();
    if (preset === 'custom' && (!this.customFrom() || !this.customTo())) {
      this.ensureCustomRangeDefaults();
    }

    this.loading.set(true);
    this.drinkPayoutService.getDashboard(this.currentDateParams()).subscribe({
      next: (data) => {
        this.freelanceRows.set(data.freelanceRows);
        this.tagRows.set(data.tagRows);
        this.freelanceUnpaidTotal.set(data.freelanceUnpaidTotal);
        this.tagUnpaidTotal.set(data.tagUnpaidTotal);
        this.rangeLabelFrom.set(data.fromDate);
        this.rangeLabelTo.set(data.toDate);
        this.loading.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถโหลดรายการจ่ายค่าดื่มได้');
        this.loading.set(false);
      },
    });
  }

  async payFreelance(row: FreelanceDrinkPayoutRow): Promise<void> {
    if (!this.canPay() || this.acting()) return;
    const ok = await this.confirmDialog.confirm({
      title: 'ยืนยันจ่ายค่าดื่ม',
      message: `จ่ายให้ ${row.nickname} วันที่ ${row.businessDateLabel}\n${row.drinksCount} ดื่ม × ${row.employeePerDrink} บาท = ${row.totalPayoutBaht.toLocaleString('th-TH')} บาท`,
      confirmLabel: 'ยืนยันจ่ายแล้ว',
    });
    if (!ok) return;
    this.acting.set(true);
    this.drinkPayoutService
      .payFreelance(row.employeeId, row.businessDate, this.currentDateParams())
      .subscribe({
        next: (data) => {
          this.acting.set(false);
          this.applyDashboardData(data);
          this.toast.showSuccess(`บันทึกจ่ายค่าดื่มให้ ${row.nickname} แล้ว`);
        },
        error: (err: { error?: { error?: string } }) => {
          this.acting.set(false);
          this.toast.showError(err.error?.error ?? 'ไม่สามารถบันทึกการจ่ายได้');
        },
      });
  }

  async payTag(row: TagDrinkPayoutRow): Promise<void> {
    if (!this.canPay() || this.acting()) return;
    const parts = [
      `จ่ายให้ ${row.nickname} (จบแท็ก ${row.tagName} วันที่ ${row.businessDateLabel})`,
      `การันตี ${row.guaranteeAmountBaht.toLocaleString('th-TH')} บาท`,
    ];
    if (row.overQuotaDrinks > 0) {
      parts.push(
        `ดื่มเกิน ${row.overQuotaDrinks} ดื่ม = ${row.overQuotaAmountBaht.toLocaleString('th-TH')} บาท`,
      );
    }
    parts.push(`รวม ${row.totalPayoutBaht.toLocaleString('th-TH')} บาท`);
    const ok = await this.confirmDialog.confirm({
      title: 'ยืนยันจ่ายค่าแท็ก',
      message: parts.join('\n'),
      confirmLabel: 'ยืนยันจ่ายแล้ว',
    });
    if (!ok) return;
    this.acting.set(true);
    this.drinkPayoutService.payTag(row.enrollmentId, this.currentDateParams()).subscribe({
      next: (data) => {
        this.acting.set(false);
        this.applyDashboardData(data);
        this.toast.showSuccess(`บันทึกจ่ายค่าแท็กให้ ${row.nickname} แล้ว`);
      },
      error: (err: { error?: { error?: string } }) => {
        this.acting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถบันทึกการจ่ายได้');
      },
    });
  }

  private applyDashboardData(data: {
    freelanceRows: FreelanceDrinkPayoutRow[];
    tagRows: TagDrinkPayoutRow[];
    freelanceUnpaidTotal: number;
    tagUnpaidTotal: number;
    fromDate: string;
    toDate: string;
  }): void {
    this.freelanceRows.set(data.freelanceRows);
    this.tagRows.set(data.tagRows);
    this.freelanceUnpaidTotal.set(data.freelanceUnpaidTotal);
    this.tagUnpaidTotal.set(data.tagUnpaidTotal);
    this.rangeLabelFrom.set(data.fromDate);
    this.rangeLabelTo.set(data.toDate);
  }
}
