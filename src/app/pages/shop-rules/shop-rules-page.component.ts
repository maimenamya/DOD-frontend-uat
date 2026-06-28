import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { CustomDropdownComponent } from '../../components/custom-dropdown/custom-dropdown.component';
import type { ShopPolicyConfig } from '../../models/shop-policy';
import { AuthService } from '../../services/auth.service';
import { ShopPolicyService } from '../../services/shop-policy.service';
import { ToastService } from '../../services/toast.service';
import {
  DRINK_ACCRUAL_ROUNDING_OPTIONS,
  type DrinkAccrualRounding,
} from '../../utils/drink-accrual.util';
import {
  highlightInvalidForm,
  resetFormValidationFlag,
} from '../../utils/form-validation.util';
import { isValidShopTimeHm, normalizeShopTimeHm } from '../../utils/shop-time.util';

type TierField =
  | 'seatDrinkTier15Drinks'
  | 'seatDrinkTier30Drinks'
  | 'seatDrinkTier45Drinks';

@Component({
  selector: 'app-shop-rules-page',
  imports: [ReactiveFormsModule, CustomDropdownComponent],
  templateUrl: './shop-rules-page.component.html',
})
export class ShopRulesPageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly policyService = inject(ShopPolicyService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly canManage = computed(() => this.auth.canWriteOnPage('master_data'));
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly formValidated = signal(false);

  readonly roundingOptions = DRINK_ACCRUAL_ROUNDING_OPTIONS;

  readonly form = this.fb.group({
    seatDrinkTier15Drinks: [1, [Validators.required, Validators.min(0)]],
    seatDrinkTier30Drinks: [2, [Validators.required, Validators.min(0)]],
    seatDrinkTier45Drinks: [3, [Validators.required, Validators.min(0)]],
    seatDrinkRounding: ['FLOOR' as DrinkAccrualRounding, Validators.required],
    lateFinePerMinuteBaht: [5, [Validators.required, Validators.min(0)]],
    absenceDeductionBaht: [500, [Validators.required, Validators.min(0)]],
    expectedCheckInTime: [''],
    expectedCheckOutTime: [''],
    expectedCheckOutNextDay: [true],
    autoCloseCutoffTime: [''],
    forgotCheckOutDeductionBaht: [0, [Validators.required, Validators.min(0)]],
  });

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.policyService.get().subscribe({
      next: (config) => {
        this.patchForm(config);
        this.loading.set(false);
      },
      error: () => {
        this.toast.showError('โหลดกฎร้านไม่สำเร็จ');
        this.loading.set(false);
      },
    });
  }

  stepTier(field: TierField, delta: number): void {
    if (!this.canManage()) return;
    const control = this.form.controls[field];
    const next = Math.max(0, control.value + delta);
    control.setValue(next);
    control.markAsDirty();
  }

  stepMoney(
    field: 'lateFinePerMinuteBaht' | 'absenceDeductionBaht' | 'forgotCheckOutDeductionBaht',
    delta: number,
  ): void {
    if (!this.canManage()) return;
    const control = this.form.controls[field];
    const next = Math.max(0, control.value + delta);
    control.setValue(next);
    control.markAsDirty();
  }

  normalizeTime(
    field: 'expectedCheckInTime' | 'expectedCheckOutTime' | 'autoCloseCutoffTime',
  ): void {
    const control = this.form.controls[field];
    control.setValue(normalizeShopTimeHm(control.value));
  }

  submit(): void {
    if (!this.canManage()) return;
    resetFormValidationFlag(this.formValidated);
    this.normalizeTime('expectedCheckInTime');
    this.normalizeTime('expectedCheckOutTime');
    this.normalizeTime('autoCloseCutoffTime');

    const checkIn = this.form.controls.expectedCheckInTime.value.trim();
    const checkOut = this.form.controls.expectedCheckOutTime.value.trim();
    const autoClose = this.form.controls.autoCloseCutoffTime.value.trim();
    if (!isValidShopTimeHm(checkIn) || !isValidShopTimeHm(checkOut)) {
      this.toast.showError('เวลาเข้า-ออกงานต้องเป็นรูปแบบ 24 ชม. เช่น 20:00');
      return;
    }
    if (autoClose && !isValidShopTimeHm(autoClose)) {
      this.toast.showError('เวลาตัดกะอัตโนมัติต้องเป็นรูปแบบ 24 ชม. เช่น 12:00');
      return;
    }

    if (highlightInvalidForm(this.form, this.formValidated, this.toast)) return;

    this.submitting.set(true);
    const raw = this.form.getRawValue();
    const value = {
      ...raw,
      autoCloseCutoffTime: raw.autoCloseCutoffTime.trim() || null,
    };
    this.policyService.save(value).subscribe({
      next: (config) => {
        this.patchForm(config);
        this.form.markAsPristine();
        this.toast.showSuccess('บันทึกกฎร้านแล้ว');
        this.submitting.set(false);
      },
      error: (err) => {
        const message =
          typeof err?.error?.error === 'string'
            ? err.error.error
            : 'บันทึกกฎร้านไม่สำเร็จ';
        this.toast.showError(message);
        this.submitting.set(false);
      },
    });
  }

  private patchForm(config: ShopPolicyConfig): void {
    this.form.patchValue({
      seatDrinkTier15Drinks: config.seatDrinkTier15Drinks,
      seatDrinkTier30Drinks: config.seatDrinkTier30Drinks,
      seatDrinkTier45Drinks: config.seatDrinkTier45Drinks,
      seatDrinkRounding: config.seatDrinkRounding,
      lateFinePerMinuteBaht: config.lateFinePerMinuteBaht,
      absenceDeductionBaht: config.absenceDeductionBaht,
      expectedCheckInTime: config.expectedCheckInTime ?? '',
      expectedCheckOutTime: config.expectedCheckOutTime ?? '',
      expectedCheckOutNextDay: config.expectedCheckOutNextDay ?? true,
      autoCloseCutoffTime: config.autoCloseCutoffTime ?? '',
      forgotCheckOutDeductionBaht: config.forgotCheckOutDeductionBaht ?? 0,
    });
    if (!this.canManage()) {
      this.form.disable();
    } else {
      this.form.enable();
    }
  }
}
