import {
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';

import type { AuthBranchOption } from '../../models/auth';
import { AuthService } from '../../services/auth.service';
import { NotificationBellComponent } from '../notification-bell/notification-bell.component';
import { ThemeService } from '../../services/theme.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-header',
  imports: [NotificationBellComponent],
  templateUrl: './app-header.component.html',
})
export class AppHeaderComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);
  private readonly toast = inject(ToastService);

  readonly menuToggle = output<void>();
  readonly uiTheme = this.themeService.theme;

  readonly profileMenuOpen = signal(false);
  readonly branches = signal<AuthBranchOption[]>([]);
  readonly switchingBranch = signal(false);

  readonly user = computed(() => this.auth.getUser());
  readonly displayNickname = computed(() => this.auth.getDisplayNickname());
  readonly currentShopId = computed(() => this.user()?.shopId ?? null);
  readonly showBranchPicker = computed(() => this.branches().length > 1);

  readonly switchableBranches = computed(() => {
    const currentId = this.currentShopId();
    return this.branches().filter((branch) => branch.shopId !== currentId);
  });

  readonly avatarInitial = computed(() => {
    const nick = this.displayNickname();
    return nick !== '—' ? nick.charAt(0).toUpperCase() : '?';
  });

  readonly themeToggleAriaLabel = computed(() =>
    this.uiTheme() === 'dark' ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด',
  );

  ngOnInit(): void {
    const cached = this.auth.getAvailableBranches();
    if (cached.length > 0) {
      this.branches.set(cached);
    }

    this.auth.fetchAccessibleBranches().subscribe({
      next: (branches) => this.branches.set(branches),
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.profileMenuOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.app-profile-menu-root')) {
      this.profileMenuOpen.set(false);
    }
  }

  onMenuClick(): void {
    this.menuToggle.emit();
  }

  toggleProfileMenu(): void {
    this.profileMenuOpen.update((open) => !open);
  }

  goToProfile(): void {
    this.profileMenuOpen.set(false);
    void this.router.navigate(['/dashboard/my-profile']);
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }

  selectBranch(shopId: number): void {
    if (!Number.isInteger(shopId) || shopId === this.currentShopId() || this.switchingBranch()) {
      return;
    }

    this.switchingBranch.set(true);
    this.auth.switchBranch(shopId).subscribe({
      next: () => {
        this.switchingBranch.set(false);
        this.profileMenuOpen.set(false);
        this.toast.showSuccess('เปลี่ยนสาขาแล้ว');
        window.location.assign(this.auth.homePathAfterLogin());
      },
      error: (err: { error?: { error?: string } }) => {
        this.switchingBranch.set(false);
        this.toast.showError(err.error?.error ?? 'เปลี่ยนสาขาไม่สำเร็จ');
      },
    });
  }

  branchLabel(branch: AuthBranchOption): string {
    return branch.branchName?.trim() || branch.branchCode;
  }
}
