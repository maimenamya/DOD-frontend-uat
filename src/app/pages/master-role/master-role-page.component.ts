import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { AppModalComponent } from '../../components/app-modal/app-modal.component';
import type { Role } from '../../models/role';
import { AuthService } from '../../services/auth.service';
import { RoleService } from '../../services/role.service';
import { ToastService } from '../../services/toast.service';
import { roleLabelThai } from '../../utils/employee-team.util';

@Component({
  selector: 'app-master-role-page',
  imports: [ReactiveFormsModule, AppModalComponent],
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
  });

  readonly editForm = this.fb.group({
    name: ['', Validators.required],
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
    this.createForm.reset({ name: '' });
    this.showCreateModal.set(true);
  }

  closeCreate(): void {
    this.showCreateModal.set(false);
  }

  openEdit(role: Role): void {
    this.editForm.reset({ name: role.name });
    this.editingRole.set(role);
  }

  closeEdit(): void {
    this.editingRole.set(null);
  }

  submitCreate(): void {
    if (this.createForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    const { name } = this.createForm.getRawValue();
    this.roleService.createRole({ name: name.trim().toUpperCase() }).subscribe({
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
    const { name } = this.editForm.getRawValue();
    this.roleService.updateRole(role.id, { name: name.trim().toUpperCase() }).subscribe({
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
