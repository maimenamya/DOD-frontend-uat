import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { AppModalComponent } from '../../components/app-modal/app-modal.component';
import {
  CustomDropdownComponent,
  type DropdownOption,
} from '../../components/custom-dropdown/custom-dropdown.component';
import {
  DEFAULT_PR_NEXT_HOUR_DRINKS,
  DEFAULT_PR_PRICE_PER_DRINK,
  DEFAULT_PR_START_DRINKS,
} from '../../constants/role-drink';
import type { MstRole, RoleCategory } from '../../models/role';
import { AuthService } from '../../services/auth.service';
import { RoleService } from '../../services/role.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';
import { roleDisplayNameTh } from '../../utils/role-display.util';

const CATEGORY_DROPDOWN_OPTIONS: DropdownOption[] = [
  { value: 'STAFF', label: 'พนักงาน (Sale, Admin, Manager)' },
  { value: 'ENTERTAINER', label: 'เด็กนั่งดริ๊งค์ (PR)' },
];

@Component({
  selector: 'app-master-role-page',
  imports: [ReactiveFormsModule, AppModalComponent, DecimalPipe, CustomDropdownComponent],
  templateUrl: './master-role-page.component.html',
})
export class MasterRolePageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly roleService = inject(RoleService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly categoryDropdownOptions = CATEGORY_DROPDOWN_OPTIONS;
  readonly roleDisplayNameTh = roleDisplayNameTh;

  readonly canManage = computed(() => this.auth.canAccessTeamManagement());
  readonly roles = signal<MstRole[]>([]);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly editingRole = signal<MstRole | null>(null);
  readonly showCreateModal = signal(false);

  readonly createForm = this.fb.group({
    name: ['', Validators.required],
    displayNameTh: ['', Validators.required],
    category: ['STAFF' as RoleCategory, Validators.required],
    startDrinks: [String(DEFAULT_PR_START_DRINKS), [Validators.required, Validators.pattern(/^\d+$/)]],
    nextHourDrinks: [String(DEFAULT_PR_NEXT_HOUR_DRINKS), [Validators.required, Validators.pattern(/^\d+$/)]],
    defaultPricePerDrink: [String(DEFAULT_PR_PRICE_PER_DRINK), [Validators.required, Validators.pattern(/^\d+$/)]],
  });

  readonly editForm = this.fb.group({
    name: ['', Validators.required],
    displayNameTh: ['', Validators.required],
    category: ['STAFF' as RoleCategory, Validators.required],
    startDrinks: ['0', [Validators.required, Validators.pattern(/^\d+$/)]],
    nextHourDrinks: ['0', [Validators.required, Validators.pattern(/^\d+$/)]],
    defaultPricePerDrink: ['0', [Validators.required, Validators.pattern(/^\d+$/)]],
  });

  ngOnInit(): void {
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
      category: 'STAFF',
      startDrinks: String(DEFAULT_PR_START_DRINKS),
      nextHourDrinks: String(DEFAULT_PR_NEXT_HOUR_DRINKS),
      defaultPricePerDrink: String(DEFAULT_PR_PRICE_PER_DRINK),
    });
    this.showCreateModal.set(true);
  }

  closeCreate(): void {
    this.showCreateModal.set(false);
  }

  openEdit(role: MstRole): void {
    this.editForm.reset({
      name: role.name,
      displayNameTh: role.displayNameTh ?? roleDisplayNameTh(role),
      category: role.category ?? (role.name === 'PR' ? 'ENTERTAINER' : 'STAFF'),
      startDrinks: String(role.startDrinks),
      nextHourDrinks: String(role.nextHourDrinks),
      defaultPricePerDrink: String(role.defaultPricePerDrink),
    });
    this.editingRole.set(role);
  }

  closeEdit(): void {
    this.editingRole.set(null);
  }

  submitCreate(): void {
    if (this.createForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    const raw = this.createForm.getRawValue();
    this.roleService
      .createRole({
        name: raw.name.trim().toUpperCase(),
        displayNameTh: raw.displayNameTh.trim(),
        category: raw.category,
        startDrinks: Number.parseInt(raw.startDrinks, 10),
        nextHourDrinks: Number.parseInt(raw.nextHourDrinks, 10),
        defaultPricePerDrink: Number.parseInt(raw.defaultPricePerDrink, 10),
      })
      .subscribe({
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
    const raw = this.editForm.getRawValue();
    this.roleService
      .updateRole(role.id, {
        name: raw.name.trim().toUpperCase(),
        displayNameTh: raw.displayNameTh.trim(),
        category: raw.category,
        startDrinks: Number.parseInt(raw.startDrinks, 10),
        nextHourDrinks: Number.parseInt(raw.nextHourDrinks, 10),
        defaultPricePerDrink: Number.parseInt(raw.defaultPricePerDrink, 10),
      })
      .subscribe({
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
    return category === 'ENTERTAINER' ? 'เด็กนั่งดริ๊งค์' : 'พนักงาน';
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
  }
}
