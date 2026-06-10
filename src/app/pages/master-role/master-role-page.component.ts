import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AppModalComponent } from '../../components/app-modal/app-modal.component';
import {
  CustomDropdownComponent,
  type DropdownOption,
} from '../../components/custom-dropdown/custom-dropdown.component';
import {
  PERMISSION_GROUPS,
  PERMISSION_GROUP_SHORT_LABEL_TH,
  type PermissionGroup,
} from '../../models/permission-group';
import type {
  DrinkAccrualMode,
  DrinkAccrualRounding,
  MstRole,
  RoleCategory,
} from '../../models/role';
import { AuthService } from '../../services/auth.service';
import { RoleService } from '../../services/role.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';
import { roleDisplayNameTh } from '../../utils/role-display.util';
import {
  DRINK_ACCRUAL_MODE_OPTIONS,
  DRINK_ACCRUAL_ROUNDING_OPTIONS,
  drinkAccrualPreviewLine,
  resolveDrinkAccrualMode,
  resolveDrinkAccrualRounding,
} from '../../utils/drink-accrual.util';

const CATEGORY_DROPDOWN_OPTIONS: DropdownOption[] = [
  { value: 'STAFF', label: 'พนักงาน' },
  { value: 'ENTERTAINER', label: 'เด็กนั่งดริ้ง' },
];

@Component({
  selector: 'app-master-role-page',
  imports: [ReactiveFormsModule, AppModalComponent, DecimalPipe, CustomDropdownComponent],
  templateUrl: './master-role-page.component.html',
})
export class MasterRolePageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly roleService = inject(RoleService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  readonly categoryDropdownOptions = CATEGORY_DROPDOWN_OPTIONS;
  readonly drinkAccrualModeOptions = DRINK_ACCRUAL_MODE_OPTIONS;
  readonly drinkAccrualRoundingOptions = DRINK_ACCRUAL_ROUNDING_OPTIONS;
  readonly roleDisplayNameTh = roleDisplayNameTh;

  readonly canManage = computed(() => this.auth.canWriteOnPage('manage_roles'));

  readonly permissionGroupDropdownOptions = computed<DropdownOption[]>(() => {
    const options = PERMISSION_GROUPS.map((g) => ({
      value: g,
      label: PERMISSION_GROUP_SHORT_LABEL_TH[g],
    }));
    if (this.auth.isOwner()) {
      return options;
    }
    return options.filter((o) => o.value !== 'OWNER');
  });

  readonly roles = signal<MstRole[]>([]);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly editingRole = signal<MstRole | null>(null);
  readonly showCreateModal = signal(false);

  readonly createForm = this.buildRoleForm();
  readonly editForm = this.buildRoleForm();

  readonly createIsEntertainer = signal(false);
  readonly editIsEntertainer = signal(false);
  readonly createAccrualMode = signal<DrinkAccrualMode>('HOUR_BLOCKS');
  readonly editAccrualMode = signal<DrinkAccrualMode>('HOUR_BLOCKS');
  readonly createDrinkPreview = signal('');
  readonly editDrinkPreview = signal('');

  ngOnInit(): void {
    this.wireRoleForm(this.createForm, {
      isEntertainer: this.createIsEntertainer,
      accrualMode: this.createAccrualMode,
      preview: this.createDrinkPreview,
    });
    this.wireRoleForm(this.editForm, {
      isEntertainer: this.editIsEntertainer,
      accrualMode: this.editAccrualMode,
      preview: this.editDrinkPreview,
    });
    this.loadRoles();
  }

  loadRoles(): void {
    this.loading.set(true);
    this.showCreateModal.set(false);
    this.roleService.getRoles().subscribe({
      next: (roles) => {
        this.roles.set(roles);
        this.loading.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถโหลดข้อมูลตำแหน่งได้');
        this.loading.set(false);
      },
    });
  }

  openCreate(): void {
    if (this.loading()) return;
    this.createForm.reset({
      name: '',
      displayNameTh: '',
      permissionGroup: 'EMPLOYEE',
      category: 'STAFF',
      startDrinks: '0',
      nextHourDrinks: '0',
      defaultPricePerDrink: '0',
      drinkAccrualMode: 'HOUR_BLOCKS',
      drinkAccrualRounding: 'FLOOR',
    });
    this.showCreateModal.set(true);
  }

  closeCreate(): void {
    this.showCreateModal.set(false);
  }

  openEdit(role: MstRole): void {
    const lockPermissionGroup = role.permissionGroup === 'OWNER';
    this.editForm.reset({
      name: role.name,
      displayNameTh: role.displayNameTh ?? roleDisplayNameTh(role),
      permissionGroup: role.permissionGroup,
      category: role.category ?? (role.name === 'PR' ? 'ENTERTAINER' : 'STAFF'),
      startDrinks: String(role.startDrinks),
      nextHourDrinks: String(role.nextHourDrinks),
      defaultPricePerDrink: String(role.defaultPricePerDrink),
      drinkAccrualMode: resolveDrinkAccrualMode(role.drinkAccrualMode),
      drinkAccrualRounding: resolveDrinkAccrualRounding(role.drinkAccrualRounding),
    });
    this.editingRole.set(role);
    if (lockPermissionGroup) {
      this.editForm.controls.permissionGroup.disable();
    } else {
      this.editForm.controls.permissionGroup.enable();
    }
  }

  permissionGroupLabel(group: PermissionGroup): string {
    return PERMISSION_GROUP_SHORT_LABEL_TH[group];
  }

  canDeleteRole(role: MstRole): boolean {
    return role.permissionGroup !== 'OWNER';
  }

  closeEdit(): void {
    this.editingRole.set(null);
  }

  submitCreate(): void {
    if (this.createForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    const payload = this.buildPayload(this.createForm);
    this.roleService.createRole(payload).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeCreate();
        this.toast.showSuccess('เพิ่มตำแหน่งเรียบร้อย');
        this.loadRoles();
      },
      error: (err: { error?: { error?: string } }) => {
        this.submitting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถเพิ่มตำแหน่งได้');
      },
    });
  }

  submitEdit(): void {
    const role = this.editingRole();
    if (!role || this.editForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    const payload = this.buildPayload(this.editForm);
    this.roleService.updateRole(role.id, payload).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeEdit();
        this.toast.showSuccess('บันทึกการแก้ไขเรียบร้อย');
        this.loadRoles();
      },
      error: (err: { error?: { error?: string } }) => {
        this.submitting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถแก้ไขตำแหน่งได้');
      },
    });
  }

  async confirmDelete(role: MstRole): Promise<void> {
    if (!this.canDeleteRole(role)) return;
    const ok = await this.confirmDialog.confirmDelete(`ตำแหน่ง "${role.name}"`);
    if (!ok) return;
    this.roleService.deleteRole(role.id).subscribe({
      next: () => {
        this.toast.showSuccess('ลบตำแหน่งเรียบร้อย');
        this.loadRoles();
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถลบตำแหน่งได้');
      },
    });
  }

  categoryLabel(category?: RoleCategory): string {
    return category === 'ENTERTAINER' ? 'เด็กนั่งดริ้ง' : 'พนักงาน';
  }

  accrualModeLabel(mode?: DrinkAccrualMode | null): string {
    return (
      DRINK_ACCRUAL_MODE_OPTIONS.find((o) => o.value === resolveDrinkAccrualMode(mode))?.label ??
      '—'
    );
  }

  sanitizeIntegerInput(
    form: 'create' | 'edit',
    controlName: 'startDrinks' | 'nextHourDrinks' | 'defaultPricePerDrink',
    event: Event,
  ): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/\D+/g, '');
    const targetForm = form === 'create' ? this.createForm : this.editForm;
    targetForm.controls[controlName].setValue(sanitized, { emitEvent: false });
    this.refreshDrinkPreview(targetForm, form === 'create' ? this.createDrinkPreview : this.editDrinkPreview);
  }

  private buildRoleForm() {
    return this.fb.group({
      name: ['', Validators.required],
      displayNameTh: ['', Validators.required],
      permissionGroup: ['EMPLOYEE' as PermissionGroup, Validators.required],
      category: ['STAFF' as RoleCategory, Validators.required],
      startDrinks: ['0', [Validators.pattern(/^\d+$/)]],
      nextHourDrinks: ['0', [Validators.pattern(/^\d+$/)]],
      defaultPricePerDrink: ['0', [Validators.pattern(/^\d+$/)]],
      drinkAccrualMode: ['HOUR_BLOCKS' as DrinkAccrualMode, Validators.required],
      drinkAccrualRounding: ['FLOOR' as DrinkAccrualRounding, Validators.required],
    });
  }

  private wireRoleForm(
    form: ReturnType<MasterRolePageComponent['buildRoleForm']>,
    signals: {
      isEntertainer: ReturnType<typeof signal<boolean>>;
      accrualMode: ReturnType<typeof signal<DrinkAccrualMode>>;
      preview: ReturnType<typeof signal<string>>;
    },
  ): void {
    const refresh = () => {
      const category = form.controls.category.value as RoleCategory;
      const isEntertainer = category === 'ENTERTAINER';
      signals.isEntertainer.set(isEntertainer);
      signals.accrualMode.set(form.controls.drinkAccrualMode.value as DrinkAccrualMode);
      this.applyEntertainerDrinkValidators(form, isEntertainer);
      this.refreshDrinkPreview(form, signals.preview);
    };

    form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => refresh());
    refresh();
  }

  private applyEntertainerDrinkValidators(
    form: ReturnType<MasterRolePageComponent['buildRoleForm']>,
    isEntertainer: boolean,
  ): void {
    const requiredPattern = [Validators.required, Validators.pattern(/^\d+$/)];
    const optionalPattern = [Validators.pattern(/^\d+$/)];

    for (const name of ['startDrinks', 'nextHourDrinks', 'defaultPricePerDrink'] as const) {
      const control = form.controls[name];
      control.setValidators(isEntertainer ? requiredPattern : optionalPattern);
      if (!isEntertainer) {
        control.setValue('0', { emitEvent: false });
        form.controls.drinkAccrualMode.setValue('HOUR_BLOCKS', { emitEvent: false });
        form.controls.drinkAccrualRounding.setValue('FLOOR', { emitEvent: false });
      }
      control.updateValueAndValidity({ emitEvent: false });
    }
  }

  private refreshDrinkPreview(
    form: ReturnType<MasterRolePageComponent['buildRoleForm']>,
    preview: ReturnType<typeof signal<string>>,
  ): void {
    if ((form.controls.category.value as RoleCategory) !== 'ENTERTAINER') {
      preview.set('');
      return;
    }
    const drinksPerHour = Number.parseInt(form.controls.nextHourDrinks.value, 10);
    preview.set(
      drinkAccrualPreviewLine(
        drinksPerHour,
        resolveDrinkAccrualMode(form.controls.drinkAccrualMode.value as DrinkAccrualMode),
        resolveDrinkAccrualRounding(form.controls.drinkAccrualRounding.value as DrinkAccrualRounding),
      ),
    );
  }

  private buildPayload(
    form: ReturnType<MasterRolePageComponent['buildRoleForm']>,
  ): import('../../models/role').MstRoleWritePayload {
    const raw = form.getRawValue();
    const isEntertainer = raw.category === 'ENTERTAINER';
    return {
      name: raw.name.trim().toUpperCase(),
      displayNameTh: raw.displayNameTh.trim(),
      permissionGroup: raw.permissionGroup,
      category: raw.category,
      startDrinks: Number.parseInt(isEntertainer ? raw.startDrinks : '0', 10),
      nextHourDrinks: Number.parseInt(isEntertainer ? raw.nextHourDrinks : '0', 10),
      defaultPricePerDrink: Number.parseInt(isEntertainer ? raw.defaultPricePerDrink : '0', 10),
      drinkAccrualMode: isEntertainer ? raw.drinkAccrualMode : 'HOUR_BLOCKS',
      drinkAccrualRounding: isEntertainer ? raw.drinkAccrualRounding : 'FLOOR',
    };
  }
}
