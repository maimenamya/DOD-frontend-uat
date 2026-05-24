import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import {
  CustomDropdownComponent,
  type DropdownOption,
} from '../../components/custom-dropdown/custom-dropdown.component';
import type { Employee } from '../../models/employee';
import type { EmployeeTeam } from '../../models/employee';
import type { Role } from '../../models/role';
import { AuthService } from '../../services/auth.service';
import { EmployeeService } from '../../services/employee.service';
import { RoleService } from '../../services/role.service';

export interface TeamPageConfig {
  team: EmployeeTeam;
  title: string;
  subtitle: string;
}

@Component({
  selector: 'app-employee-team-page',
  imports: [ReactiveFormsModule, CustomDropdownComponent],
  templateUrl: './employee-team-page.component.html',
})
export class EmployeeTeamPageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly employeeService = inject(EmployeeService);
  private readonly roleService = inject(RoleService);

  readonly config = this.route.snapshot.data as TeamPageConfig;
  readonly user = this.auth.getUser();

  readonly employees = signal<Employee[]>([]);
  readonly dbRoles = signal<Role[]>([]);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly editingEmployee = signal<Employee | null>(null);
  readonly showCreateForm = signal(false);

  readonly canManage = computed(() => {
    if (this.config.team === 'managers') {
      return this.auth.isOwner();
    }
    return this.auth.canAccessTeamManagement();
  });

  readonly roleDropdownOptions = computed<DropdownOption[]>(() => {
    const roles = this.dbRoles();
    if (this.config.team === 'sale') {
      return roles.filter((r) => r.name === 'SALE').map((r) => ({ value: r.id, label: r.name }));
    }
    if (this.config.team === 'pr') {
      return roles.filter((r) => r.name === 'PR').map((r) => ({ value: r.id, label: r.name }));
    }
    return roles
      .filter((r) => r.name === 'ADMIN' || r.name === 'MANAGER')
      .map((r) => ({ value: r.id, label: r.name }));
  });

  readonly statusDropdownOptions: DropdownOption[] = [
    { value: 'Active', label: 'Active' },
    { value: 'Inactive', label: 'Inactive' },
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

  ngOnInit(): void {
    this.roleService.getRoles().subscribe({
      next: (roles) => {
        this.dbRoles.set(roles);
        const defaultRole = this.roleDropdownOptions()[0];
        if (defaultRole) {
          this.createForm.patchValue({ roleId: Number(defaultRole.value) });
        }
      },
    });
    this.loadEmployees();
  }

  roleBadgeClass(role?: string): string {
    const map: Record<string, string> = {
      OWNER: 'app-badge-owner',
      ADMIN: 'app-badge-admin',
      MANAGER: 'app-badge-manager',
      SALE: 'app-badge-sale',
      PR: 'app-badge-pr',
    };
    const variant = map[role ?? ''] ?? 'app-badge-default';
    return `app-badge ${variant}`;
  }

  canMutateRow(employee: Employee): boolean {
    if (employee.role?.name === 'OWNER') {
      return false;
    }
    if (this.config.team === 'managers') {
      return this.auth.canMutateOnManagersPage(employee.role?.name);
    }
    return this.auth.canMutateEmployeeRow(employee.role?.name);
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

    this.employeeService.getEmployeesByTeam(shopId, this.config.team).subscribe({
      next: (data) => {
        this.employees.set(data);
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
    this.showCreateForm.set(true);
    this.editingEmployee.set(null);
    const defaultRoleId = this.roleDropdownOptions()[0]?.value ?? 0;
    this.createForm.reset({
      employeeId: '',
      password: '',
      nickname: '',
      email: '',
      roleId: Number(defaultRoleId),
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
    if (shopId == null) return;

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
        team: this.config.team,
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

    this.error.set(null);
    this.success.set(null);

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
