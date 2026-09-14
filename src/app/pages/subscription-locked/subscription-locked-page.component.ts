import { Component, OnInit, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-subscription-locked-page',
  imports: [RouterLink],
  templateUrl: './subscription-locked-page.component.html',
})
export class SubscriptionLockedPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly expiresOn = computed(
    () => this.auth.getUser()?.shop.subscriptionExpiresOn ?? null,
  );
  readonly graceEndedOn = computed(
    () => this.auth.getUser()?.shop.subscriptionGraceEndsOn ?? null,
  );
  readonly isOwner = computed(() => this.auth.isOwner());

  ngOnInit(): void {
    if (!this.auth.isSubscriptionLocked()) {
      void this.router.navigate([this.auth.homePathAfterLogin()]);
    }
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
