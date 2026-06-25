import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/** Sale only — read-only own bills (not shared with open-table ops menu). */
export const saleSelfBillGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.openTableSelfBillOnly()) {
    return true;
  }

  return router.createUrlTree(auth.homeRouteSegments());
};
