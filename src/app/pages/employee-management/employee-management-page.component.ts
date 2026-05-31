import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
import type { MstEmployee } from '../../models/employee';
import type { MstRole } from '../../models/role';
import { AuthService } from '../../services/auth.service';
import { EmployeeService } from '../../services/employee.service';
import { RoleService } from '../../services/role.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';
import {
  isRoleMutableByViewer,
  roleBadgeClass,
  roleDisplayNameTh,
  roleOptionLabel,
  teamForRole,
} from '../../utils/employee-team.util';

@Component({
  selector: 'app-employee-management-page',
  imports: [ReactiveFormsModule, CustomDropdownComponent, AppModalComponent],
  templateUrl: './employee-management-page.component.html',
})
export class EmployeeManagementPageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly employeeService = inject(EmployeeService);
  private readonly roleService = inject(RoleService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly user = this.auth.getUser();
  readonly canManage = computed(() => this.auth.canAccessTeamManagement());

  readonly roles = signal<MstRole[]>([]);
  readonly allEmployees = signal<MstEmployee[]>([]);
  readonly selectedRoleName = signal<string | null>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly editingEmployee = signal<MstEmployee | null>(null);
  readonly showCreateForm = signal(false);

  readonly tabRoles = computed(() => {
    const list = this.roles();
    if (this.auth.isOwner()) {
      return list;
    }
    return list.filter((r) => r.name !== 'OWNER');
  });

  readonly filteredEmployees = computed(() => {
    const roleName = this.selectedRoleName();
    if (!roleName) {
      return [];
    }
    return this.allEmployees().filter((e) => e.role?.name === roleName);
  });

  readonly selectedRole = computed(() =>
    this.tabRoles().find((r) => r.name === this.selectedRoleName()),
  );

  readonly statusDropdownOptions: DropdownOption[] = [
    { value: 'Active', label: 'ใช้งาน' },
    { value: 'Inactive', label: 'ไม่ใช้งาน' },
  ];

  readonly createForm = this.fb.group({
    employeeId: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    nickname: ['', [Validators.required, Validators.minLength(1)]],
    email: [''],
    roleId: [0, [Validators.required, Validators.min(1)]],
  });

  readonly editForm = this.fb.group({
    nickname: ['', [Validators.required, Validators.minLength(1)]],
    email: [''],
    status: ['Active', Validators.required],
    roleId: [0, [Validators.required, Validators.min(1)]],
    password: [''],
  });

  /** Create: lock to tab role; owner on manager tabs may pick ADMIN or MANAGER. */
  readonly createRoleDropdownOptions = computed<DropdownOption[]>(() => {
    const selected = this.selectedRole();
    if (!selected) {
      return [];
    }
    if (this.auth.isOwner() && (selected.name === 'ADMIN' || selected.name === 'MANAGER')) {
      return this.tabRoles()
        .filter((r) => r.name === 'ADMIN' || r.name === 'MANAGER')
        .map((r) => ({ value: r.id, label: roleOptionLabel(r) }));
    }
    return [{ value: selected.id, label: roleOptionLabel(selected) }];
  });

  /** Dropdown only when owner picks ADMIN vs MANAGER; other tabs lock to tab role. */
  readonly showCreateRolePicker = computed(() => this.createRoleDropdownOptions().length > 1);

  readonly editRoleDropdownOptions = computed<DropdownOption[]>(() =>
    this.tabRoles()
      .filter(
        (r) =>
          r.name !== 'OWNER' &&
          isRoleMutableByViewer(r, this.auth.isOwner(), this.auth.canAccessTeamManagement()),
      )
      .map((r) => ({ value: r.id, label: roleOptionLabel(r) })),
  );

  ngOnInit(): void {
    this.roleService.getRoles().subscribe({
      next: (roles) => {
        this.roles.set(roles);
        const fromQuery = this.route.snapshot.queryParamMap.get('role');
        const tabs = this.auth.isOwner() ? roles : roles.filter((r) => r.name !== 'OWNER');
        const initial =
          tabs.find((r) => r.name === fromQuery)?.name ?? tabs[0]?.name ?? null;
        if (initial) {
          this.selectRole(initial, false);
        }
      },
      error: () => this.toast.showError('ไม่สามารถโหลดรายการตำแหน่งได้'),
    });

    this.loadEmployees();
  }

  roleTabLabel(role: MstRole): string {
    return roleDisplayNameTh(role);
  }

  selectRole(roleName: string, updateUrl = true): void {
    this.selectedRoleName.set(roleName);
    this.showCreateForm.set(false);
    this.editingEmployee.set(null);
    const role = this.roles().find((r) => r.name === roleName);
    if (role) {
      this.createForm.patchValue({ roleId: role.id });
    }
    if (updateUrl) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { role: roleName },
        queryParamsHandling: 'merge',
      });
    }
  }

  roleBadgeClassForEmployee(emp: MstEmployee): string {
    return roleBadgeClass(emp.role ?? null);
  }

  roleBadgeLabel(emp: MstEmployee): string {
    if (!emp.role) return '—';
    return roleDisplayNameTh(emp.role);
  }

  canMutateRow(employee: MstEmployee): boolean {
    const role = employee.role;
    if (!role) return false;
    return isRoleMutableByViewer(
      { name: role.name, category: role.category ?? 'STAFF' },
      this.auth.isOwner(),
      this.auth.canAccessTeamManagement(),
    );
  }

  loadEmployees(): void {
    const shopId = this.auth.getShopId();
    if (shopId == null) {
      this.toast.showError('ไม่พบข้อมูลร้าน กรุณาเข้าสู่ระบบใหม่');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.showCreateForm.set(false);

    this.employeeService.getEmployeesByShop(shopId).subscribe({
      next: (data) => {
        this.allEmployees.set(data);
        this.loading.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถโหลดรายชื่อพนักงานได้');
        this.loading.set(false);
      },
    });
  }

  openCreateForm(): void {
    if (!this.canManage() || this.loading()) return;
    const role = this.selectedRole();
    if (!role || role.name === 'OWNER') return;

    this.showCreateForm.set(true);
    this.editingEmployee.set(null);
    this.createForm.reset({
      employeeId: '',
      password: '',
      nickname: '',
      email: '',
      roleId: role.id,
    });
  }

  closeCreateForm(): void {
    this.showCreateForm.set(false);
  }

  openEdit(employee: MstEmployee): void {
    if (!this.canMutateRow(employee)) return;
    this.editingEmployee.set(employee);
    this.showCreateForm.set(false);
    this.editForm.patchValue({
      nickname: employee.nickname,
      email: employee.email ?? '',
      status: employee.status,
      roleId: employee.roleId,
      password: '',
    });
  }

  closeEdit(): void {
    this.editingEmployee.set(null);
  }

  submitCreate(): void {
    if (!this.canManage() || this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const shopId = this.auth.getShopId();
    const tabRole = this.selectedRole();
    const roleId = this.showCreateRolePicker()
      ? this.createForm.controls.roleId.value
      : tabRole?.id;
    const role = this.roles().find((r) => r.id === roleId);
    if (shopId == null || !role || !tabRole) return;

    const raw = this.createForm.getRawValue();
    this.submitting.set(true);

    this.employeeService
      .createEmployee({
        employeeId: raw.employeeId,
        password: raw.password,
        nickname: raw.nickname,
        roleId: role.id,
        shopId,
        team: teamForRole(role),
        email: raw.email || undefined,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.closeCreateForm();
          this.toast.showSuccess('เพิ่มพนักงานสำเร็จ');
          this.loadEmployees();
        },
        error: (err: { error?: { error?: string } }) => {
          this.submitting.set(false);
          this.toast.showError(err.error?.error ?? 'ไม่สามารถเพิ่มพนักงานได้');
        },
      });
  }

  submitEdit(): void {
    const employee = this.editingEmployee();
    if (!employee || !this.canMutateRow(employee) || this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const raw = this.editForm.getRawValue();
    this.submitting.set(true);

    this.employeeService
      .updateEmployee(employee.id, {
        nickname: raw.nickname,
        email: raw.email || null,
        status: raw.status,
        roleId: raw.roleId,
        password: raw.password || undefined,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.closeEdit();
          this.toast.showSuccess('บันทึกการแก้ไขสำเร็จ');
          this.loadEmployees();
        },
        error: (err: { error?: { error?: string } }) => {
          this.submitting.set(false);
          this.toast.showError(err.error?.error ?? 'ไม่สามารถแก้ไขพนักงานได้');
        },
      });
  }

  async confirmDelete(employee: MstEmployee): Promise<void> {
    if (!this.canMutateRow(employee)) return;

    const ok = await this.confirmDialog.confirm({
      title: 'ยืนยันการลบ',
      message: `ต้องการลบพนักงาน "${employee.nickname}" (${employee.employeeId}) ใช่หรือไม่?`,
      confirmLabel: 'ลบ',
    });
    if (!ok) return;

    this.employeeService.deleteEmployee(employee.id).subscribe({
      next: () => {
        this.closeEdit();
        this.toast.showSuccess('ลบพนักงานสำเร็จ');
        this.loadEmployees();
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถลบพนักงานได้');
      },
    });
  }
}
