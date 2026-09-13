import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { CustomDropdownComponent } from '../../components/custom-dropdown/custom-dropdown.component';
import type { DropdownOption } from '../../components/custom-dropdown/custom-dropdown.component';
import type { ShopPolicyConfig } from '../../models/shop-policy';
import { AuthService } from '../../services/auth.service';
import { ShopPolicyService } from '../../services/shop-policy.service';
import { ThaiAddressService } from '../../services/thai-address.service';
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
import {
  MIN_PASSWORD_LENGTH,
  generateShopInitialPassword,
  passwordMeetsPolicy,
  passwordPolicyErrorMessage,
} from '../../utils/password-policy.util';
import { FieldErrorComponent } from '../../components/field-error/field-error.component';

type TierField =
  | 'seatDrinkTier15Drinks'
  | 'seatDrinkTier30Drinks'
  | 'seatDrinkTier45Drinks';

type LateDrinkTierForm = FormGroup<{
  cutoffTime: FormControl<string>;
  extraShopPortionBaht: FormControl<number>;
}>;

const MAX_FREELANCE_LATE_TIERS = 10;

@Component({
  selector: 'app-shop-rules-page',
  imports: [
    FieldErrorComponent,
    ReactiveFormsModule, CustomDropdownComponent, RouterLink],
  templateUrl: './shop-rules-page.component.html',
})
export class ShopRulesPageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly policyService = inject(ShopPolicyService);
  private readonly thaiAddress = inject(ThaiAddressService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly canManage = computed(() => this.auth.canWriteOnPage('master_data'));
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly formValidated = signal(false);
  readonly showInitialPassword = signal(false);

  readonly roundingOptions = DRINK_ACCRUAL_ROUNDING_OPTIONS;
  readonly minPasswordLength = MIN_PASSWORD_LENGTH;

  readonly provinceOptions = signal<DropdownOption[]>([]);
  readonly districtOptions = signal<DropdownOption[]>([]);
  readonly subdistrictOptions = signal<DropdownOption[]>([]);
  private subdistrictPostalById = new Map<number, string | null>();

  private addressHydrating = false;

  readonly form = this.fb.group({
    seatDrinkTier15Drinks: [1, [Validators.required, Validators.min(0)]],
    seatDrinkTier30Drinks: [2, [Validators.required, Validators.min(0)]],
    seatDrinkTier45Drinks: [3, [Validators.required, Validators.min(0)]],
    seatDrinkRounding: ['FLOOR' as DrinkAccrualRounding, Validators.required],
    lateFinePerMinuteBaht: [5, [Validators.required, Validators.min(0)]],
    absenceDeductionBaht: [500, [Validators.required, Validators.min(0)]],
    expectedCheckInTime: [''],
    expectedOnFloorTime: [''],
    freelanceLateDrinkTiers: this.fb.array<LateDrinkTierForm>([]),
    expectedCheckOutNextDay: [true],
    autoCloseCutoffTime: [''],
    forgotCheckOutDeductionBaht: [0, [Validators.required, Validators.min(0)]],
    employeeInitialPassword: [
      '',
      [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH)],
    ],
    addressLine: [''],
    provinceId: this.fb.control<number | null>(null),
    districtId: this.fb.control<number | null>(null),
    subdistrictId: this.fb.control<number | null>(null),
    postalCode: [{ value: '', disabled: true }],
    latitude: [''],
    longitude: [''],
  });

  ngOnInit(): void {
    this.form.controls.provinceId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((provinceId) => {
        if (this.addressHydrating) return;
        this.onProvinceChanged(provinceId);
      });
    this.form.controls.districtId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((districtId) => {
        if (this.addressHydrating) return;
        this.onDistrictChanged(districtId);
      });
    this.form.controls.subdistrictId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((subdistrictId) => {
        if (this.addressHydrating) return;
        this.onSubdistrictChanged(subdistrictId);
      });
    this.reload();
  }

  get lateTiers(): FormArray<LateDrinkTierForm> {
    return this.form.controls.freelanceLateDrinkTiers;
  }

  addLateTier(): void {
    if (!this.canManage() || this.submitting()) return;
    if (this.lateTiers.length >= MAX_FREELANCE_LATE_TIERS) {
      this.toast.showError(`ตั้งรอบหักสายได้ไม่เกิน ${MAX_FREELANCE_LATE_TIERS} รอบ`);
      return;
    }
    this.lateTiers.push(this.buildLateTierGroup());
    this.lateTiers.markAsDirty();
  }

  removeLateTier(index: number): void {
    if (!this.canManage() || this.submitting()) return;
    this.lateTiers.removeAt(index);
    this.lateTiers.markAsDirty();
  }

  stepLateExtra(index: number, delta: number): void {
    if (!this.canManage()) return;
    const control = this.lateTiers.at(index).controls.extraShopPortionBaht;
    control.setValue(Math.max(0, control.value + delta));
    control.markAsDirty();
  }

  normalizeLateTime(index: number): void {
    const control = this.lateTiers.at(index).controls.cutoffTime;
    control.setValue(normalizeShopTimeHm(control.value));
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
    field:
      | 'lateFinePerMinuteBaht'
      | 'absenceDeductionBaht'
      | 'forgotCheckOutDeductionBaht',
    delta: number,
  ): void {
    if (!this.canManage()) return;
    const control = this.form.controls[field];
    const next = Math.max(0, control.value + delta);
    control.setValue(next);
    control.markAsDirty();
  }

  normalizeTime(
    field:
      | 'expectedCheckInTime'
      | 'expectedOnFloorTime'
      | 'autoCloseCutoffTime',
  ): void {
    const control = this.form.controls[field];
    control.setValue(normalizeShopTimeHm(control.value));
  }

  submit(): void {
    if (!this.canManage()) return;
    resetFormValidationFlag(this.formValidated);
    this.normalizeTime('expectedCheckInTime');
    this.normalizeTime('expectedOnFloorTime');
    this.normalizeTime('autoCloseCutoffTime');

    const checkIn = this.form.controls.expectedCheckInTime.value.trim();
    const onFloor = this.form.controls.expectedOnFloorTime.value.trim();
    const autoClose = this.form.controls.autoCloseCutoffTime.value.trim();
    if (checkIn && !isValidShopTimeHm(checkIn)) {
      this.form.controls.expectedCheckInTime.setErrors({ timeFormat: true });
      this.form.controls.expectedCheckInTime.markAsTouched();
      this.formValidated.set(true);
      return;
    }
    if (onFloor && !isValidShopTimeHm(onFloor)) {
      this.form.controls.expectedOnFloorTime.setErrors({ timeFormat: true });
      this.form.controls.expectedOnFloorTime.markAsTouched();
      this.formValidated.set(true);
      return;
    }
    if (autoClose && !isValidShopTimeHm(autoClose)) {
      this.form.controls.autoCloseCutoffTime.setErrors({ timeFormat: true });
      this.form.controls.autoCloseCutoffTime.markAsTouched();
      this.formValidated.set(true);
      return;
    }

    const lateTiers = this.lateTiers.controls;
    const seenCutoffs = new Set<string>();
    for (const row of lateTiers) {
      const cutoff = normalizeShopTimeHm(row.controls.cutoffTime.value);
      row.controls.cutoffTime.setValue(cutoff);
      if (!cutoff) continue;
      if (!isValidShopTimeHm(cutoff)) {
        row.controls.cutoffTime.setErrors({ timeFormat: true });
        row.controls.cutoffTime.markAsTouched();
        this.formValidated.set(true);
        return;
      }
      if (seenCutoffs.has(cutoff)) {
        row.controls.cutoffTime.setErrors({ duplicate: true });
        row.controls.cutoffTime.markAsTouched();
        this.formValidated.set(true);
        this.toast.showError('เวลาหักสาย freelance ซ้ำกันไม่ได้');
        return;
      }
      seenCutoffs.add(cutoff);
    }

    if (highlightInvalidForm(this.form, this.formValidated)) return;

    const initialPassword = this.form.controls.employeeInitialPassword.value.trim();
    if (!passwordMeetsPolicy(initialPassword)) {
      this.form.controls.employeeInitialPassword.setErrors({
        passwordPolicy: { message: passwordPolicyErrorMessage() },
      });
      this.form.controls.employeeInitialPassword.markAsTouched();
      this.formValidated.set(true);
      return;
    }

    this.submitting.set(true);
    const raw = this.form.getRawValue();
    const provinceId = raw.provinceId;
    const districtId = raw.districtId;
    const subdistrictId = raw.subdistrictId;
    const latitude = this.parseOptionalCoordinate(raw.latitude);
    const longitude = this.parseOptionalCoordinate(raw.longitude);
    if (latitude === 'INVALID' || longitude === 'INVALID') {
      this.toast.showError('พิกัด GPS ไม่ถูกต้อง');
      this.formValidated.set(true);
      this.submitting.set(false);
      return;
    }
    if ((latitude == null) !== (longitude == null)) {
      this.toast.showError('กรุณาระบุละติจูดและลองจิจูดคู่กัน หรือเว้นว่างทั้งคู่');
      this.formValidated.set(true);
      this.submitting.set(false);
      return;
    }

    const value: import('../../models/shop-policy').ShopPolicyInput = {
      seatDrinkTier15Drinks: raw.seatDrinkTier15Drinks,
      seatDrinkTier30Drinks: raw.seatDrinkTier30Drinks,
      seatDrinkTier45Drinks: raw.seatDrinkTier45Drinks,
      seatDrinkRounding: raw.seatDrinkRounding,
      lateFinePerMinuteBaht: raw.lateFinePerMinuteBaht,
      absenceDeductionBaht: raw.absenceDeductionBaht,
      expectedCheckInTime: raw.expectedCheckInTime.trim() || null,
      expectedOnFloorTime: raw.expectedOnFloorTime.trim() || null,
      expectedCheckOutNextDay: raw.expectedCheckOutNextDay,
      autoCloseCutoffTime: raw.autoCloseCutoffTime.trim() || null,
      forgotCheckOutDeductionBaht: raw.forgotCheckOutDeductionBaht,
      freelanceLateDrinkTiers: raw.freelanceLateDrinkTiers
        .map((row) => ({
          cutoffTime: row.cutoffTime.trim(),
          extraShopPortionBaht: row.extraShopPortionBaht,
        }))
        .filter((row) => row.cutoffTime && row.extraShopPortionBaht > 0),
      freelanceLateDrinkCutoffTime: null,
      freelanceLateDrinkExtraShopPortionBaht: 0,
      employeeInitialPassword: initialPassword,
      addressLine: raw.addressLine.trim() || null,
      provinceId,
      districtId,
      subdistrictId,
      postalCode: raw.postalCode.trim() || null,
      latitude,
      longitude,
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

  randomizeInitialPassword(): void {
    if (!this.canManage()) return;
    this.form.controls.employeeInitialPassword.setValue(generateShopInitialPassword());
    this.form.controls.employeeInitialPassword.markAsDirty();
    this.showInitialPassword.set(true);
  }

  toggleInitialPasswordVisible(): void {
    this.showInitialPassword.update((v) => !v);
  }

  private patchForm(config: ShopPolicyConfig): void {
    const savedPassword = config.employeeInitialPassword?.trim() ?? '';
    const initialPassword = savedPassword || generateShopInitialPassword();
    this.addressHydrating = true;
    this.form.patchValue({
      seatDrinkTier15Drinks: config.seatDrinkTier15Drinks,
      seatDrinkTier30Drinks: config.seatDrinkTier30Drinks,
      seatDrinkTier45Drinks: config.seatDrinkTier45Drinks,
      seatDrinkRounding: config.seatDrinkRounding,
      lateFinePerMinuteBaht: config.lateFinePerMinuteBaht,
      absenceDeductionBaht: config.absenceDeductionBaht,
      expectedCheckInTime: config.expectedCheckInTime ?? '',
      expectedOnFloorTime: config.expectedOnFloorTime ?? '',
      expectedCheckOutNextDay: config.expectedCheckOutNextDay ?? true,
      autoCloseCutoffTime: config.autoCloseCutoffTime ?? '',
      forgotCheckOutDeductionBaht: config.forgotCheckOutDeductionBaht ?? 0,
      employeeInitialPassword: initialPassword,
      addressLine: config.addressLine ?? '',
      provinceId: config.provinceId,
      districtId: config.districtId,
      subdistrictId: config.subdistrictId,
      postalCode: config.postalCode ?? '',
      latitude: config.latitude != null ? String(config.latitude) : '',
      longitude: config.longitude != null ? String(config.longitude) : '',
    });
    this.replaceLateTiers(config);
    void this.hydrateAddressOptions(config).finally(() => {
      this.addressHydrating = false;
    });
    if (!savedPassword && this.canManage()) {
      this.form.controls.employeeInitialPassword.markAsDirty();
      this.showInitialPassword.set(true);
    }
    if (!this.canManage()) {
      this.form.disable();
    } else {
      this.form.enable();
      this.form.controls.postalCode.disable({ emitEvent: false });
    }
  }

  private async hydrateAddressOptions(config: ShopPolicyConfig): Promise<void> {
    await this.loadProvinces();
    if (config.provinceId != null) {
      await this.loadDistricts(config.provinceId);
    } else {
      this.districtOptions.set([]);
    }
    if (config.districtId != null) {
      await this.loadSubdistricts(config.districtId);
    } else {
      this.subdistrictOptions.set([]);
    }
  }

  private async loadProvinces(): Promise<void> {
    try {
      const rows = await firstValueFrom(this.thaiAddress.listProvinces());
      this.provinceOptions.set(rows.map((row) => ({ value: row.id, label: row.nameTh })));
    } catch {
      this.toast.showError('โหลดจังหวัดไม่สำเร็จ');
    }
  }

  private async loadDistricts(provinceId: number): Promise<void> {
    try {
      const rows = await firstValueFrom(this.thaiAddress.listDistricts(provinceId));
      this.districtOptions.set(rows.map((row) => ({ value: row.id, label: row.nameTh })));
    } catch {
      this.toast.showError('โหลดอำเภอไม่สำเร็จ');
      this.districtOptions.set([]);
    }
  }

  private async loadSubdistricts(districtId: number): Promise<void> {
    try {
      const rows = await firstValueFrom(this.thaiAddress.listSubdistricts(districtId));
      this.subdistrictPostalById = new Map(rows.map((row) => [row.id, row.postalCode]));
      this.subdistrictOptions.set(
        rows.map((row) => ({
          value: row.id,
          label: row.postalCode ? `${row.nameTh} (${row.postalCode})` : row.nameTh,
        })),
      );
    } catch {
      this.toast.showError('โหลดตำบลไม่สำเร็จ');
      this.subdistrictPostalById = new Map();
      this.subdistrictOptions.set([]);
    }
  }

  private onProvinceChanged(provinceId: number | null): void {
    this.form.controls.districtId.setValue(null, { emitEvent: false });
    this.form.controls.subdistrictId.setValue(null, { emitEvent: false });
    this.form.controls.postalCode.setValue('', { emitEvent: false });
    this.subdistrictOptions.set([]);
    this.subdistrictPostalById = new Map();
    if (provinceId == null) {
      this.districtOptions.set([]);
      return;
    }
    void this.loadDistricts(provinceId);
  }

  private onDistrictChanged(districtId: number | null): void {
    this.form.controls.subdistrictId.setValue(null, { emitEvent: false });
    this.form.controls.postalCode.setValue('', { emitEvent: false });
    this.subdistrictPostalById = new Map();
    if (districtId == null) {
      this.subdistrictOptions.set([]);
      return;
    }
    void this.loadSubdistricts(districtId);
  }

  private onSubdistrictChanged(subdistrictId: number | null): void {
    if (subdistrictId == null) {
      this.form.controls.postalCode.setValue('', { emitEvent: false });
      return;
    }
    this.form.controls.postalCode.setValue(
      this.subdistrictPostalById.get(subdistrictId) ?? '',
      { emitEvent: false },
    );
  }

  private parseOptionalCoordinate(raw: string): number | null | 'INVALID' {
    const text = raw.trim();
    if (!text) return null;
    const n = Number(text);
    if (!Number.isFinite(n)) return 'INVALID';
    return Math.round(n * 1e7) / 1e7;
  }

  private buildLateTierGroup(
    cutoffTime = '',
    extraShopPortionBaht = 0,
  ): LateDrinkTierForm {
    return this.fb.group({
      cutoffTime: [cutoffTime],
      extraShopPortionBaht: [extraShopPortionBaht, [Validators.required, Validators.min(0)]],
    });
  }

  private replaceLateTiers(config: ShopPolicyConfig): void {
    const fromApi = config.freelanceLateDrinkTiers ?? [];
    const tiers =
      fromApi.length > 0
        ? fromApi
        : config.freelanceLateDrinkCutoffTime && config.freelanceLateDrinkExtraShopPortionBaht > 0
          ? [
              {
                cutoffTime: config.freelanceLateDrinkCutoffTime,
                extraShopPortionBaht: config.freelanceLateDrinkExtraShopPortionBaht,
              },
            ]
          : [];
    this.lateTiers.clear();
    for (const tier of tiers) {
      this.lateTiers.push(this.buildLateTierGroup(tier.cutoffTime, tier.extraShopPortionBaht));
    }
  }
}
