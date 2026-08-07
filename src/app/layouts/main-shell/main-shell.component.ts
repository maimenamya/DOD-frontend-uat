import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AppHeaderComponent } from '../../components/app-header/app-header.component';
import { ConfirmDialogHostComponent } from '../../components/confirm-dialog/confirm-dialog-host.component';
import { AppToastComponent } from '../../components/app-toast/app-toast.component';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { PRIVACY_POLICY_VERSION } from '../../constants/privacy-policy.constant';
import { AuthService } from '../../services/auth.service';
import {
  dismissPrivacyConsentBanner,
  isPrivacyConsentBannerDismissed,
} from '../../utils/privacy-consent-banner.storage';

@Component({
  selector: 'app-main-shell',
  imports: [
    RouterOutlet,
    SidebarComponent,
    AppHeaderComponent,
    AppToastComponent,
    ConfirmDialogHostComponent,
  ],
  templateUrl: './main-shell.component.html',
  styleUrl: './main-shell.component.css',
})
export class MainShellComponent {
  private readonly auth = inject(AuthService);

  readonly mobileMenuOpen = signal(false);
  /** Bumps when user dismisses so computed re-evaluates sessionStorage. */
  private readonly bannerDismissTick = signal(0);

  readonly showPrivacyConsentBanner = computed(() => {
    this.bannerDismissTick();
    this.auth.session();
    if (this.auth.needsPrivacyConsent()) return false;
    if (!this.auth.orgPrivacyConsentPending()) return false;
    const user = this.auth.getUser();
    if (!user) return false;
    return !isPrivacyConsentBannerDismissed(user.organizationId, PRIVACY_POLICY_VERSION);
  });

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeMobileMenu();
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  dismissPrivacyBanner(): void {
    const user = this.auth.getUser();
    if (!user) return;
    dismissPrivacyConsentBanner(user.organizationId, PRIVACY_POLICY_VERSION);
    this.bannerDismissTick.update((n) => n + 1);
  }
}
