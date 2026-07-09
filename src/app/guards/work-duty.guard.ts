import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import type { WorkDuty } from '../models/work-duty';
import { AuthService } from '../services/auth.service';

export function workDutyGuard(duty: WorkDuty): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (auth.hasWorkDuty(duty)) {
      return true;
    }
    return router.createUrlTree(['/dashboard']);
  };
}
