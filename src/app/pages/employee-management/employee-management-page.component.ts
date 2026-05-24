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
import type { Employee } from '../../models/employee';
import type { Role } from '../../models/role';
import { AuthService } from '../../services/auth.service';
import { EmployeeService } from '../../services/employee.service';
import { RoleService } from '../../services/role.service';
import {
  isRoleMutableByViewer,
  roleLabelThai,
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

  readonly user = this.auth.getUser();
  readonly canManage = computed(() => this.auth.canAccessTeamManagement());

  readonly roles = signal<Role[]>([]);
  readonly allEmployees = signal<Employee[]>([]);
  readonly selectedRoleName = signal<string | null>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly editingEmployee = signal<Employee | null>(null);
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

  readonly roleDropdownOptions = computed<DropdownOption[]>(() =>
    this.tabRoles().map((r) => ({
      value: r.id,
      label: roleLabelThai(r.name),
    })),
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
      error: () => this.error.set('ไม่สามารถโหลดรายการตำแหน่งได้'),
    });

    this.loadEmployees();
  }

  roleLabel(roleName: string): string {
    return roleLabelThai(roleName);
  }

  selectRole(roleName: string, updateUrl = true): void {
    this.selectedRoleName.set(roleName);
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

  roleBadgeClass(role?: string): string {
    const map: Record<string, string> = {
      OWNER: 'app-badge-owner',
      ADMIN: 'app-badge-admin',
      MANAGER: 'app-badge-manager',
      SALE: 'app-badge-sale',
      PR: 'app-badge-pr',
    };
    return `app-badge ${map[role ?? ''] ?? 'app-badge-default'}`;
  }

  canMutateRow(employee: Employee): boolean {
    return isRoleMutableByViewer(
      employee.role?.name,
      this.auth.isOwner(),
      this.auth.canAccessTeamManagement(),
    );
  }

  loadEmployees(): void {
    const shopId = this.auth.getShopId();
    if (shopId == null) {
      this.error.set('ไม่พบข้อมูลร้าน กรุณาเข้าสู่ระบบใหม่');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.employeeService.getEmployeesByShop(shopId).subscribe({
      next: (data) => {
        this.allEmployees.set(data);
        this.loading.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.error.set(err.error?.error ?? 'ไม่สามารถโหลดรายชื่อพนักงานได้');
        this.loading.set(false);
      },
    });
  }

  openCreateForm(): void {
    if (!this.canManage()) return;
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

  openEdit(employee: Employee): void {
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
    const role = this.roles().find((r) => r.id === this.createForm.controls.roleId.value);
    if (shopId == null || !role) return;

    const raw = this.createForm.getRawValue();
    this.submitting.set(true);
    this.error.set(null);
    this.success.set(null);

    this.employeeService
      .createEmployee({
        employeeId: raw.employeeId,
        password: raw.password,
        nickname: raw.nickname,
        roleId: raw.roleId,
        shopId,
        team: teamForRole(role.name),
        email: raw.email || undefined,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.success.set('เพิ่มพนักงานสำเร็จ');
          this.closeCreateForm();
          this.loadEmployees();
        },
        error: (err: { error?: { error?: string } }) => {
          this.submitting.set(false);
          this.error.set(err.error?.error ?? 'ไม่สามารถเพิ่มพนักงานได้');
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
    this.error.set(null);
    this.success.set(null);

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
          this.success.set('บันทึกการแก้ไขสำเร็จ');
          this.closeEdit();
          this.loadEmployees();
        },
        error: (err: { error?: { error?: string } }) => {
          this.submitting.set(false);
          this.error.set(err.error?.error ?? 'ไม่สามารถแก้ไขพนักงานได้');
        },
      });
  }

  confirmDelete(employee: Employee): void {
    if (!this.canMutateRow(employee)) return;

    const confirmed = window.confirm(
      `ต้องการลบพนักงาน "${employee.nickname}" (${employee.employeeId}) ใช่หรือไม่?`,
    );
    if (!confirmed) return;

    this.employeeService.deleteEmployee(employee.id).subscribe({
      next: () => {
        this.success.set('ลบพนักงานสำเร็จ');
        if (this.editingEmployee()?.id === employee.id) {
          this.closeEdit();
        }
        this.loadEmployees();
      },
      error: (err: { error?: { error?: string } }) => {
        this.error.set(err.error?.error ?? 'ไม่สามารถลบพนักงานได้');
      },
    });
  }
}
