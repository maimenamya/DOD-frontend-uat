import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { ConfigService } from '../../services/config.service';
import { SidebarIconComponent, type SidebarIconName } from './sidebar-icon.component';

export interface SidebarNavLink {
  path: string;
  label: string;
}

export interface SidebarNavGroup {
  id: string;
  label: string;
  icon: SidebarIconName;
  children: SidebarNavLink[];
}

export const MANAGEMENT_NAV_GROUPS: SidebarNavGroup[] = [
  {
    id: 'employees',
    label: 'จัดการพนักงาน',
    icon: 'employees',
    children: [
      { path: '/dashboard/employees', label: 'พนักงาน' },
      { path: '/dashboard/master-roles', label: 'ตำแหน่ง' },
    ],
  },
  {
    id: 'drinks',
    label: 'เครื่องดื่ม',
    icon: 'drinks',
    children: [
      { path: '/dashboard/master-drinks', label: 'เครื่องดื่ม' },
      { path: '/dashboard/master-cocktails', label: 'ค็อกเทล' },
    ],
  },
  {
    id: 'food',
    label: 'อาหาร',
    icon: 'food',
    children: [
      { path: '/dashboard/master-foods', label: 'อาหาร' },
      { path: '/dashboard/master-food-categories', label: 'ประเภทอาหาร' },
    ],
  },
  {
    id: 'seatings',
    label: 'จัดการที่นั่ง',
    icon: 'seatings',
    children: [
      { path: '/dashboard/master-seatings', label: 'โซนที่นั่ง' },
      { path: '/dashboard/master-seating-types', label: 'ประเภทโซนที่นั่ง' },
    ],
  },
  {
    id: 'marketing',
    label: 'MstPromotion/Member',
    icon: 'marketing',
    children: [
      { path: '/dashboard/master-promotions', label: 'โปรโมชั่น' },
      { path: '/dashboard/master-memberships', label: 'เมมเบอร์' },
    ],
  },
  {
    id: 'pr-tag-master',
    label: 'แพ็กเกจแท็ก',
    icon: 'package',
    children: [{ path: '/dashboard/master-pr-tags', label: 'แพ็กเกจแท็ก PR' }],
  },
  {
    id: 'other-charges',
    label: 'อื่นๆ',
    icon: 'more',
    children: [{ path: '/dashboard/master-other-charges', label: 'รายการอื่นๆ' }],
  },
];

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, SidebarIconComponent],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly configService = inject(ConfigService);
  private readonly router = inject(Router);

  readonly mobileOpen = input(false);
  readonly mobileClose = output<void>();

  readonly shopDisplayName = computed(() => this.auth.getShopDisplayName());

  readonly showOpenTable = computed(() => this.auth.hasFeature('open_table'));
  readonly showPrTagOps = computed(() => this.auth.hasFeature('pr_tag_operations'));
  readonly showReports = computed(() => this.auth.hasFeature('reports'));
  readonly showMasterNav = computed(() => this.auth.hasFeature('master_data'));

  readonly navGroups = MANAGEMENT_NAV_GROUPS;
  readonly activeSubmenu = signal<string | null>(this.getGroupIdByCurrentRoute());
  readonly lineOaAddFriendUrl = signal<string | null>(null);

  ngOnInit(): void {
    this.configService.getClientConfig().subscribe((cfg) => {
      this.lineOaAddFriendUrl.set(cfg.lineOaAddFriendUrl);
    });
  }

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
    const url = this.router.url;
    const group = MANAGEMENT_NAV_GROUPS.find((g) =>
      g.children.some((c) => url.startsWith(c.path)),
    );
    return group?.id ?? null;
  }
}
