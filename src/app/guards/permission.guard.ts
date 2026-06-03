import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';
import type { AppFeature } from '../utils/permission-group.util';

export function permissionGuard(feature: AppFeature): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (auth.hasFeature(feature)) {
      return true;
    }

    return router.createUrlTree(['/dashboard']);
  };
}
