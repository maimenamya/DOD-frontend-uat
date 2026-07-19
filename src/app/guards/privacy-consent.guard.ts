import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/** Redirect OWNER to privacy consent before using the app (after password change if any). */
export const privacyConsentChildGuard: CanActivateChildFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.needsPasswordChange()) {
    return true;
  }

  if (!auth.needsPrivacyConsent()) {
    return true;
  }

  if (state.url.includes('/accept-privacy')) {
    return true;
  }

  return router.createUrlTree(['/dashboard/accept-privacy']);
};
