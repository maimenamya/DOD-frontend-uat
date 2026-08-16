import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/** Keep pending-setup accounts on the confirm-role page until setup is done. */
export const pendingRoleSetupChildGuard: CanActivateChildFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.needsRoleSetup()) {
    return true;
  }

  if (state.url.includes('/complete-role-setup')) {
    return true;
  }

  return router.createUrlTree(['/dashboard/complete-role-setup']);
};
