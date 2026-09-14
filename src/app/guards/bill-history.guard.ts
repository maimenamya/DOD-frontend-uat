import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/** OWNER/MANAGER/CASHIER: all bills. Sale EMPLOYEE: own bills only. */
export const billHistoryGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.canAccessBillHistory()) {
    return true;
  }

  return router.createUrlTree(auth.homeRouteSegments());
};
