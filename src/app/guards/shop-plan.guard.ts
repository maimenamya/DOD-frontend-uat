import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';
import type { ShopPlanFeature } from '../utils/shop-plan.util';

export function shopPlanGuard(feature: ShopPlanFeature): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (auth.hasShopPlanFeature(feature)) {
      return true;
    }

    return router.createUrlTree(auth.homeRouteSegments());
  };
}
