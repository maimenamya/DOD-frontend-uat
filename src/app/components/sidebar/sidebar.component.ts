import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { hasStationWorkMenu } from '../../models/work-duty';
import { SystemGuideModalComponent } from '../system-guide/system-guide-modal.component';
import { DodBrandWordmarkComponent } from './dod-brand-wordmark.component';
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
      { path: '/dashboard/attendance-roster', label: 'บันทึกเวลาเข้างาน' },
    ],
  },
  {
    id: 'drinks',
    label: 'เครื่องดื่ม',
    icon: 'drinks',
    children: [
      { path: '/dashboard/master-drinks', label: 'เครื่องดื่ม' },
      { path: '/dashboard/master-beverage-categories', label: 'ประเภทเครื่องดื่ม' },
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
    label: 'โปร/เมม',
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
    label: 'เบ็ดเตล็ด',
    icon: 'more',
    children: [
      { path: '/dashboard/master-other-charges', label: 'เบ็ดเตล็ด' },
      { path: '/dashboard/master-table-opening-charges', label: 'ค่าเปิดโต๊ะ' },
    ],
  },
  {
    id: 'stock',
    label: 'คลังสินค้า',
    icon: 'stock',
    children: [{ path: '/dashboard/stock', label: 'สต็อกเครื่องดื่ม' }],
  },
  {
    id: 'shop-settings',
    label: 'ตั้งค่าร้าน',
    icon: 'shop-rules',
    children: [
      { path: '/dashboard/shop-rules', label: 'กฎร้าน' },
      { path: '/dashboard/receipt-printer', label: 'เครื่องพิมพ์ใบเสร็จ' },
    ],
  },
];

@Component({
  selector: 'app-sidebar',
  imports: [
    RouterLink,
    RouterLinkActive,
    DodBrandWordmarkComponent,
    SidebarIconComponent,
    SystemGuideModalComponent,
  ],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly mobileOpen = input(false);
  readonly mobileClose = output<void>();

  readonly showSaleSelfBillNav = computed(() => {
    this.auth.session();
    return this.auth.openTableSelfBillOnly();
  });
  readonly showFullOpenTableNav = computed(() => this.auth.hasFeature('open_table'));
  readonly showPackageDepositsNav = computed(() => this.auth.hasFeature('open_table'));
  readonly showPrTagOps = computed(() => this.auth.hasFeature('pr_tag_operations'));
  readonly showDrinkPayout = computed(() => this.auth.hasFeature('drink_payout'));
  readonly showReports = computed(() => this.auth.hasFeature('reports'));
  readonly showDailyExpenses = computed(() => this.auth.hasFeature('daily_expenses'));
  readonly showMasterNav = computed(() => this.auth.hasFeature('master_data'));
  readonly showStationWork = computed(() => {
    this.auth.session();
    return hasStationWorkMenu(this.auth.getUser());
  });

  readonly navGroups = MANAGEMENT_NAV_GROUPS;
  readonly activeSubmenu = signal<string | null>(this.getGroupIdByCurrentRoute());
  readonly guideOpen = signal(false);

  ngOnInit(): void {
    this.syncSubmenuToRoute();
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => this.syncSubmenuToRoute());
  }

  openGuide(): void {
    this.guideOpen.set(true);
  }

  closeGuide(): void {
    this.guideOpen.set(false);
  }

  toggleSubmenu(id: string): void {
    this.activeSubmenu.update((current) => (current === id ? null : id));
  }

  isGroupExpanded(id: string): boolean {
    return this.activeSubmenu() === id;
  }

  isGroupOpen(id: string): boolean {
    if (this.isGroupExpanded(id)) {
      return true;
    }
    const group = this.navGroups.find((g) => g.id === id);
    return group ? this.isGroupActive(group) : false;
  }

  isGroupActive(group: SidebarNavGroup): boolean {
    return group.children.some((child) => this.routeMatches(child.path));
  }

  collapseAllSubmenus(): void {
    this.activeSubmenu.set(null);
  }

  logout(): void {
    this.auth.logout();
    this.auth.redirectToLogin();
  }

  private syncSubmenuToRoute(): void {
    const groupId = this.getGroupIdByCurrentRoute();
    if (groupId) {
      this.activeSubmenu.set(groupId);
    }
  }

  private routeMatches(path: string): boolean {
    const url = this.router.url.split('?')[0].split('#')[0];
    return url === path || url.startsWith(`${path}/`);
  }

  private getGroupIdByCurrentRoute(): string | null {
    if (this.routeMatches('/dashboard/daily-expenses')) {
      return null;
    }
    const group = MANAGEMENT_NAV_GROUPS.find((g) =>
      g.children.some((c) => this.routeMatches(c.path)),
    );
    return group?.id ?? null;
  }
}
