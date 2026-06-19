import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { readStoredShopPublicId } from '../core/shop-public-id.storage';
import { AuthService } from '../services/auth.service';

function loginUrlTree(router: Router) {
  const lastShop = readStoredShopPublicId();
  return lastShop
    ? router.createUrlTree(['/s', lastShop, 'login'])
    : router.createUrlTree(['/login']);
}

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  return loginUrlTree(router);
};

/** @deprecated Use permissionGuard('master_data') or finer feature guards. */
export const teamManagementGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.canAccessTeamManagement()) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};
