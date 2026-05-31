import { Component, computed, inject, output } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  templateUrl: './app-header.component.html',
})
export class AppHeaderComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly menuToggle = output<void>();

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

  onMenuClick(): void {
    this.menuToggle.emit();
  }

  goToProfile(): void {
    void this.router.navigate(['/dashboard/my-profile']);
  }

}
