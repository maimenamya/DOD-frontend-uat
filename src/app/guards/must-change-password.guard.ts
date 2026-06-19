import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/** Redirect to profile when employee must set a new password (first login / after reset). */
export const mustChangePasswordChildGuard: CanActivateChildFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.needsPasswordChange()) {
    return true;
  }

  if (state.url.includes('/my-profile')) {
    return true;
  }

  return router.createUrlTree(['/dashboard/my-profile']);
};
