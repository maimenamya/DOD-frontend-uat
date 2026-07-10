import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import {
  highlightInvalidForm,
  resetFormValidationFlag,
} from '../../utils/form-validation.util';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AppModalComponent } from '../../components/app-modal/app-modal.component';
import { ListPaginatorComponent } from '../../components/list-paginator/list-paginator.component';
import { MasterListToolbarComponent } from '../../components/master-list-toolbar/master-list-toolbar.component';
import {
  CustomDropdownComponent,
  type DropdownOption,
} from '../../components/custom-dropdown/custom-dropdown.component';
import {
  PERMISSION_GROUPS,
  PERMISSION_GROUP_SHORT_LABEL_TH,
  type PermissionGroup,
} from '../../models/permission-group';
import type { MstRole, RoleCategory } from '../../models/role';
import { AuthService } from '../../services/auth.service';
import { RoleService } from '../../services/role.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';
import { roleDisplayNameTh, compareRolesByThaiLabel } from '../../utils/role-display.util';
import { canMutateRoleRecord } from '../../utils/permission-group.util';
import {
  WORK_DUTY_OPTIONS,
  canConfigureWorkDuties,
  parseWorkDuties,
  workDutyLabels,
  type WorkDuty,
} from '../../models/work-duty';
import {
  MasterListQueryState,
  createMasterListView,
  masterListRowNumber,
} from '../../utils/master-list.util';

const CATEGORY_DROPDOWN_OPTIONS: DropdownOption[] = [
  { value: 'STAFF', label: 'พนักงาน' },
  { value: 'ENTERTAINER', label: 'เด็กนั่งดริ้ง' },
];

@Component({
  selector: 'app-master-role-page',
  imports: [ReactiveFormsModule, AppModalComponent, DecimalPipe, CustomDropdownComponent, MasterListToolbarComponent, ListPaginatorComponent, RouterLink],
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
  readonly workDutyDropdownOptions: DropdownOption[] = WORK_DUTY_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
  }));
  readonly workDutyLabels = workDutyLabels;
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
    if (this.auth.getPermissionGroup() === 'CASHIER') {
      return options.filter((o) => o.value === 'CASHIER' || o.value === 'EMPLOYEE');
    }
    return options.filter((o) => o.value !== 'OWNER');
  });

  readonly roles = signal<MstRole[]>([]);
  readonly listQuery = new MasterListQueryState();
  readonly listView = createMasterListView(this.roles, this.listQuery, (role) =>
    `${role.name} ${roleDisplayNameTh(role)} ${role.category}`,
  );
  readonly masterListRowNumber = masterListRowNumber;
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly createFormValidated = signal(false);
  readonly editFormValidated = signal(false);
  readonly editingRole = signal<MstRole | null>(null);
  readonly showCreateModal = signal(false);

  readonly createForm = this.buildRoleForm();
  readonly editForm = this.buildRoleForm();

  readonly createIsEntertainer = signal(false);
  readonly editIsEntertainer = signal(false);
  readonly createIsStaff = signal(true);
  readonly editIsStaff = signal(true);

  ngOnInit(): void {
    this.wireRoleForm(this.createForm, this.createIsEntertainer);
    this.wireRoleForm(this.editForm, this.editIsEntertainer);
    this.loadRoles();
  }

  loadRoles(): void {
    this.loading.set(true);
    this.showCreateModal.set(false);
    this.roleService.getRoles().subscribe({
      next: (roles) => {
        this.roles.set([...roles].sort(compareRolesByThaiLabel));
        this.loading.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถโหลดข้อมูลตำแหน่งได้');
        this.loading.set(false);
      },
    });
  }

  openCreate(): void {
    resetFormValidationFlag(this.createFormValidated);
    if (this.loading()) return;
    this.createForm.reset({
      name: '',
      displayNameTh: '',
      permissionGroup: 'EMPLOYEE',
      category: 'STAFF',
      startDrinks: '0',
      nextHourDrinks: '0',
      defaultPricePerDrink: '0',
      drinkShopPortionBaht: '60',
      attendanceLeaveQuotaPerMonth: '0',
      workDuties: [],
    });
    this.showCreateModal.set(true);
  }

  closeCreate(): void {
    this.showCreateModal.set(false);
  }

  openEdit(role: MstRole): void {
    if (!this.canEditRole(role)) return;
    resetFormValidationFlag(this.editFormValidated);
    const lockPermissionGroup = role.permissionGroup === 'OWNER';
    this.editForm.reset({
      name: role.name,
      displayNameTh: role.displayNameTh ?? roleDisplayNameTh(role),
      permissionGroup: role.permissionGroup,
      category: role.category ?? (role.name === 'PR' ? 'ENTERTAINER' : 'STAFF'),
      startDrinks: String(role.startDrinks),
      nextHourDrinks: String(role.nextHourDrinks),
      defaultPricePerDrink: String(role.defaultPricePerDrink),
      drinkShopPortionBaht: String(role.drinkShopPortionBaht ?? 60),
      attendanceLeaveQuotaPerMonth: String(role.attendanceLeaveQuotaPerMonth ?? 0),
      workDuties: [...(role.workDuties ?? [])],
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
    if (role.permissionGroup === 'OWNER') return false;
    return this.canEditRole(role);
  }

  canEditRole(role: MstRole): boolean {
    if (!this.canManage()) return false;
    const viewer = this.auth.getPermissionGroup();
    if (!viewer) return false;
    return canMutateRoleRecord(viewer, role.permissionGroup);
  }

  closeEdit(): void {
    this.editingRole.set(null);
  }

  submitCreate(): void {
    if (this.submitting()) return;
    if (highlightInvalidForm(this.createForm, this.createFormValidated, this.toast)) return;
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
    if (!role || this.submitting()) return;
    if (highlightInvalidForm(this.editForm, this.editFormValidated, this.toast)) return;
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

  showWorkDutiesForForm(form: 'create' | 'edit'): boolean {
    const targetForm = form === 'create' ? this.createForm : this.editForm;
    return canConfigureWorkDuties(targetForm.controls.permissionGroup.value);
  }

  sanitizeIntegerInput(
    form: 'create' | 'edit',
    controlName: 'startDrinks' | 'nextHourDrinks' | 'defaultPricePerDrink' | 'drinkShopPortionBaht' | 'attendanceLeaveQuotaPerMonth',
    event: Event,
  ): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/\D+/g, '');
    const targetForm = form === 'create' ? this.createForm : this.editForm;
    targetForm.controls[controlName].setValue(sanitized, { emitEvent: false });
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
      drinkShopPortionBaht: ['60', [Validators.pattern(/^\d+$/)]],
      attendanceLeaveQuotaPerMonth: ['0', [Validators.pattern(/^\d+$/)]],
      workDuties: [[] as WorkDuty[]],
    });
  }

  private wireRoleForm(
    form: ReturnType<MasterRolePageComponent['buildRoleForm']>,
    isEntertainer: ReturnType<typeof signal<boolean>>,
  ): void {
    const refresh = () => {
      const category = form.controls.category.value as RoleCategory;
      isEntertainer.set(category === 'ENTERTAINER');
      const isStaff = category === 'STAFF';
      if (form === this.createForm) {
        this.createIsStaff.set(isStaff);
      } else {
        this.editIsStaff.set(isStaff);
      }
      this.applyEntertainerDrinkValidators(form, category === 'ENTERTAINER');
    };

    form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => refresh());
    form.controls.permissionGroup.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((group) => {
        if (!canConfigureWorkDuties(group)) {
          form.controls.workDuties.setValue([], { emitEvent: false });
        }
      });
    refresh();
  }

  private applyEntertainerDrinkValidators(
    form: ReturnType<MasterRolePageComponent['buildRoleForm']>,
    isEntertainer: boolean,
  ): void {
    const requiredPattern = [Validators.required, Validators.pattern(/^\d+$/)];
    const optionalPattern = [Validators.pattern(/^\d+$/)];

    form.controls.defaultPricePerDrink.setValidators(requiredPattern);
    form.controls.defaultPricePerDrink.updateValueAndValidity({ emitEvent: false });

    form.controls.drinkShopPortionBaht.setValidators(requiredPattern);
    form.controls.drinkShopPortionBaht.updateValueAndValidity({ emitEvent: false });

    const startDrinks = form.controls.startDrinks;
    startDrinks.setValidators(isEntertainer ? requiredPattern : optionalPattern);
    startDrinks.updateValueAndValidity({ emitEvent: false });

    const nextHourDrinks = form.controls.nextHourDrinks;
    nextHourDrinks.setValidators(isEntertainer ? requiredPattern : optionalPattern);
    nextHourDrinks.updateValueAndValidity({ emitEvent: false });
  }

  private buildPayload(
    form: ReturnType<MasterRolePageComponent['buildRoleForm']>,
  ): import('../../models/role').MstRoleWritePayload {
    const raw = form.getRawValue();
    const isEntertainer = raw.category === 'ENTERTAINER';
    const isStaff = raw.category === 'STAFF';
    return {
      name: raw.name.trim().toUpperCase(),
      displayNameTh: raw.displayNameTh.trim(),
      permissionGroup: raw.permissionGroup,
      category: raw.category,
      startDrinks: Number.parseInt(isEntertainer ? raw.startDrinks : '0', 10),
      nextHourDrinks: Number.parseInt(isEntertainer ? raw.nextHourDrinks : '0', 10),
      defaultPricePerDrink: Number.parseInt(raw.defaultPricePerDrink, 10),
      drinkShopPortionBaht: Number.parseInt(raw.drinkShopPortionBaht, 10),
      attendanceLeaveQuotaPerMonth: Number.parseInt(
        raw.attendanceLeaveQuotaPerMonth || '0',
        10,
      ),
      workDuties: canConfigureWorkDuties(raw.permissionGroup)
        ? parseWorkDuties(raw.workDuties)
        : [],
    };
  }
}
