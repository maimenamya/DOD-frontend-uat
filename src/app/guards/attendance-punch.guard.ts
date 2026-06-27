import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { readStoredShopPublicId } from '../core/shop-public-id.storage';
import { AuthService } from '../services/auth.service';

/** Punch page: require login; preserve return URL for post-login redirect. */
export const attendancePunchGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  const shopPublicId =
    _route.paramMap.get('shopPublicId')?.trim() || readStoredShopPublicId();
  const returnUrl = state.url;

  return router.createUrlTree(
    shopPublicId ? ['/s', shopPublicId, 'login'] : ['/login'],
    { queryParams: { returnUrl } },
  );
};
