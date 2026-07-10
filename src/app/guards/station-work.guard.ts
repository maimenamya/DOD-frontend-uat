import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import {
  STATION_WORK_TAB_DUTY,
  hasStationWorkMenu,
  stationWorkTabsForUser,
  type StationWorkTab,
} from '../models/work-duty';
import { AuthService } from '../services/auth.service';

function parseStationWorkTab(value: string | undefined): StationWorkTab | null {
  if (value === 'food' || value === 'drink' || value === 'pickup') {
    return value;
  }
  return null;
}

export const stationWorkGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (hasStationWorkMenu(auth.getUser())) {
    return true;
  }
  return router.createUrlTree(['/dashboard']);
};

export const stationWorkTabGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = auth.getUser();
  const tabs = stationWorkTabsForUser(user);
  if (tabs.length === 0) {
    return router.createUrlTree(['/dashboard']);
  }

  const requested = parseStationWorkTab(route.paramMap.get('tab') ?? undefined);
  if (!requested) {
    return router.createUrlTree(['/dashboard/station-work', tabs[0]]);
  }

  const duty = STATION_WORK_TAB_DUTY[requested];
  if (!auth.hasWorkDuty(duty)) {
    return router.createUrlTree(['/dashboard/station-work', tabs[0]]);
  }

  return true;
};
