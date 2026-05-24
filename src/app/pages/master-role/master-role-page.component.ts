import { Component, OnInit, inject, signal } from '@angular/core';

import type { Role } from '../../models/role';
import { RoleService } from '../../services/role.service';
import { roleLabelThai } from '../../utils/employee-team.util';

@Component({
  selector: 'app-master-role-page',
  templateUrl: './master-role-page.component.html',
})
export class MasterRolePageComponent implements OnInit {
  private readonly roleService = inject(RoleService);

  readonly roles = signal<Role[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.roleService.getRoles().subscribe({
      next: (roles) => {
        this.roles.set(roles);
        this.loading.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.error.set(err.error?.error ?? 'ไม่สามารถโหลดข้อมูลตำแหน่งได้');
        this.loading.set(false);
      },
    });
  }

  roleLabel(name: string): string {
    return roleLabelThai(name);
  }
}
