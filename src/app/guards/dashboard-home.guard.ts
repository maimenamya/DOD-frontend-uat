import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { homeRouteSegmentsForUser, showDashboardNav } from '../models/work-duty';
import { AuthService } from '../services/auth.service';

/** Redirect station-only staff away from dashboard home to คิวงาน / ลงเวลา. */
export const dashboardHomeGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = auth.getUser();

  if (user && !showDashboardNav(user)) {
    return router.createUrlTree(homeRouteSegmentsForUser(user));
  }

  return true;
};
