import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/**
 * After role / password / privacy gates: lock the app when subscription is past grace.
 * Allows my-profile (logout / password) and the locked info page.
 */
export const subscriptionLockedChildGuard: CanActivateChildFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.needsRoleSetup() || auth.needsPasswordChange() || auth.needsPrivacyConsent()) {
    return true;
  }

  if (!auth.isSubscriptionLocked()) {
    return true;
  }

  const url = state.url;
  if (
    url.includes('/subscription-locked') ||
    url.includes('/my-profile') ||
    url.includes('/accept-privacy')
  ) {
    return true;
  }

  return router.createUrlTree(['/dashboard/subscription-locked']);
};
