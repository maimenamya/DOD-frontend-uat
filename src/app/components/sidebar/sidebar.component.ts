import { Component, inject, input, output, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../services/auth.service';

export interface SidebarNavLink {
  path: string;
  label: string;
}

export interface SidebarNavGroup {
  id: string;
  label: string;
  icon: string;
  children: SidebarNavLink[];
}

export const MANAGEMENT_NAV_GROUPS: SidebarNavGroup[] = [
  {
    id: 'employees',
    label: 'จัดการพนักงาน',
    icon: '👥',
    children: [
      { path: '/dashboard/employees', label: 'พนักงาน' },
      { path: '/dashboard/master-roles', label: 'ตำแหน่ง' },
    ],
  },
  {
    id: 'drinks',
    label: 'เครื่องดื่ม',
    icon: '🍸',
    children: [
      { path: '/dashboard/master-drinks', label: 'เครื่องดื่ม' },
      { path: '/dashboard/master-cocktails', label: 'ค็อกเทล' },
    ],
  },
  {
    id: 'food',
    label: 'อาหาร',
    icon: '🍽️',
    children: [
      { path: '/dashboard/master-foods', label: 'อาหาร' },
      { path: '/dashboard/master-food-categories', label: 'ประเภทอาหาร' },
    ],
  },
  {
    id: 'seatings',
    label: 'จัดการที่นั่ง',
    icon: '🪑',
    children: [
      { path: '/dashboard/master-seatings', label: 'โซนที่นั่ง' },
      { path: '/dashboard/master-seating-types', label: 'ประเภทโซนที่นั่ง' },
    ],
  },
  {
    id: 'marketing',
    label: 'MstPromotion/Member',
    icon: '🎁',
    children: [
      { path: '/dashboard/master-promotions', label: 'โปรโมชั่น' },
      { path: '/dashboard/master-memberships', label: 'เมมเบอร์' },
    ],
  },
  {
    id: 'other-charges',
    label: 'อื่นๆ',
    icon: '🧾',
    children: [{ path: '/dashboard/master-other-charges', label: 'รายการอื่นๆ' }],
  },
  {
    id: 'pr-tag-master',
    label: 'แพ็กเกจแท็ก',
    icon: '📋',
    children: [{ path: '/dashboard/master-pr-tags', label: 'แพ็กเกจแท็ก PR' }],
  },
];

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly mobileOpen = input(false);
  readonly mobileClose = output<void>();

  readonly showManagementLinks = this.auth.canAccessTeamManagement();
  readonly navGroups = MANAGEMENT_NAV_GROUPS;
  readonly activeSubmenu = signal<string | null>(this.getGroupIdByCurrentRoute());

  toggleSubmenu(id: string): void {
    this.activeSubmenu.update((current) => (current === id ? null : id));
  }

  isGroupExpanded(id: string): boolean {
    return this.activeSubmenu() === id;
  }

  collapseAllSubmenus(): void {
    this.activeSubmenu.set(null);
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }

  private getGroupIdByCurrentRoute(): string | null {
    const currentUrl = this.router.url;
    const group = this.navGroups.find((g) =>
      g.children.some((c) => currentUrl.startsWith(c.path)),
    );
    return group?.id ?? null;
  }
}
