import { Component, computed, inject, output } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-header',
  templateUrl: './app-header.component.html',
})
export class AppHeaderComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);

  readonly menuToggle = output<void>();
  readonly uiTheme = this.themeService.theme;

  readonly user = computed(() => this.auth.getUser());
  readonly displayNickname = computed(() => this.auth.getDisplayNickname());
  readonly avatarInitial = computed(() => {
    const nick = this.displayNickname();
    return nick !== '—' ? nick.charAt(0).toUpperCase() : '?';
  });

  readonly roleDisplayLabel = computed(() => {
    const user = this.user();
    if (!user) return '—';
    return user.roleDisplayNameTh?.trim() || '—';
  });

  readonly themeToggleAriaLabel = computed(() =>
    this.uiTheme() === 'dark' ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด',
  );

  onMenuClick(): void {
    this.menuToggle.emit();
  }

  goToProfile(): void {
    void this.router.navigate(['/dashboard/my-profile']);
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }
}
