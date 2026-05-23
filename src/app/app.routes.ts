import { Routes } from '@angular/router';

import { authGuard, guestGuard, ownerOnlyGuard, teamManagementGuard } from './guards/auth.guard';
import { MainShellComponent } from './layouts/main-shell/main-shell.component';
import { DashboardPageComponent } from './pages/dashboard/dashboard-page.component';
import { EmployeeTeamPageComponent } from './pages/employee-team/employee-team-page.component';
import { LoginComponent } from './pages/login/login.component';
import { MyProfileComponent } from './pages/my-profile/my-profile.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [guestGuard],
  },
  {
    path: 'dashboard',
    component: MainShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', component: DashboardPageComponent },
      {
        path: 'sale-team',
        component: EmployeeTeamPageComponent,
        canActivate: [teamManagementGuard],
        data: {
          team: 'sale',
          title: 'SALE Team',
          subtitle: 'Manage sales team members — full CRUD for OWNER, ADMIN, and MANAGER',
        },
      },
      {
        path: 'pr-team',
        component: EmployeeTeamPageComponent,
        canActivate: [teamManagementGuard],
        data: {
          team: 'pr',
          title: 'PR Team',
          subtitle: 'Manage PR drink team members — full CRUD for OWNER, ADMIN, and MANAGER',
        },
      },
      {
        path: 'managers',
        component: EmployeeTeamPageComponent,
        canActivate: [ownerOnlyGuard],
        data: {
          team: 'managers',
          title: 'Managers',
          subtitle: 'OWNER only — manage ADMIN and MANAGER accounts',
        },
      },
      { path: 'my-profile', component: MyProfileComponent },
      { path: 'manage-employees', redirectTo: 'sale-team', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
