import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { AppModalComponent } from '../../components/app-modal/app-modal.component';
import {
  DEFAULT_PR_NEXT_HOUR_DRINKS,
  DEFAULT_PR_PRICE_PER_DRINK,
  DEFAULT_PR_START_DRINKS,
} from '../../constants/role-drink';
import type { Role } from '../../models/role';
import { AuthService } from '../../services/auth.service';
import { RoleService } from '../../services/role.service';
import { ToastService } from '../../services/toast.service';
import { roleLabelThai } from '../../utils/employee-team.util';

@Component({
  selector: 'app-master-role-page',
  imports: [ReactiveFormsModule, AppModalComponent, DecimalPipe],
  templateUrl: './master-role-page.component.html',
})
export class MasterRolePageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly roleService = inject(RoleService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly canManage = computed(() => this.auth.canAccessTeamManagement());
  readonly roles = signal<Role[]>([]);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly editingRole = signal<Role | null>(null);
  readonly showCreateModal = signal(false);

  readonly createForm = this.fb.group({
    name: ['', Validators.required],
    startDrinks: [DEFAULT_PR_START_DRINKS, [Validators.required, Validators.min(0)]],
    nextHourDrinks: [DEFAULT_PR_NEXT_HOUR_DRINKS, [Validators.required, Validators.min(0)]],
    defaultPricePerDrink: [DEFAULT_PR_PRICE_PER_DRINK, [Validators.required, Validators.min(0)]],
  });

  readonly editForm = this.fb.group({
    name: ['', Validators.required],
    startDrinks: [0, [Validators.required, Validators.min(0)]],
    nextHourDrinks: [0, [Validators.required, Validators.min(0)]],
    defaultPricePerDrink: [0, [Validators.required, Validators.min(0)]],
  });

  ngOnInit(): void {
    this.loadRoles();
  }

  loadRoles(): void {
    this.loading.set(true);
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
    this.createForm.reset({
      name: '',
      startDrinks: DEFAULT_PR_START_DRINKS,
      nextHourDrinks: DEFAULT_PR_NEXT_HOUR_DRINKS,
      defaultPricePerDrink: DEFAULT_PR_PRICE_PER_DRINK,
    });
    this.showCreateModal.set(true);
  }

  closeCreate(): void {
    this.showCreateModal.set(false);
  }

  openEdit(role: Role): void {
    this.editForm.reset({
      name: role.name,
      startDrinks: role.startDrinks,
      nextHourDrinks: role.nextHourDrinks,
      defaultPricePerDrink: role.defaultPricePerDrink,
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
        startDrinks: raw.startDrinks,
        nextHourDrinks: raw.nextHourDrinks,
        defaultPricePerDrink: raw.defaultPricePerDrink,
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
        startDrinks: raw.startDrinks,
        nextHourDrinks: raw.nextHourDrinks,
        defaultPricePerDrink: raw.defaultPricePerDrink,
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

  confirmDelete(role: Role): void {
    if (!confirm(`ลบตำแหน่ง "${role.name}" ใช่หรือไม่?`)) return;
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

  roleLabel(name: string): string {
    return roleLabelThai(name);
  }
}
