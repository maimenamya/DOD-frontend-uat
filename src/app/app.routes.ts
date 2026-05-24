import { Routes } from '@angular/router';

import { authGuard, guestGuard, teamManagementGuard } from './guards/auth.guard';
import { MainShellComponent } from './layouts/main-shell/main-shell.component';
import { DashboardPageComponent } from './pages/dashboard/dashboard-page.component';
import { EmployeeManagementPageComponent } from './pages/employee-management/employee-management-page.component';
import { LoginComponent } from './pages/login/login.component';
import { MasterDrinkPageComponent } from './pages/master-drink/master-drink-page.component';
import { MasterRolePageComponent } from './pages/master-role/master-role-page.component';
import { MyProfileComponent } from './pages/my-profile/my-profile.component';
import { RecordDrinksPageComponent } from './pages/record-drinks/record-drinks-page.component';

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
        path: 'record-drinks',
        component: RecordDrinksPageComponent,
        canActivate: [teamManagementGuard],
      },
      {
        path: 'employees',
        component: EmployeeManagementPageComponent,
        canActivate: [teamManagementGuard],
      },
      {
        path: 'master-roles',
        component: MasterRolePageComponent,
        canActivate: [teamManagementGuard],
      },
      {
        path: 'master-drinks',
        component: MasterDrinkPageComponent,
        canActivate: [teamManagementGuard],
      },
      { path: 'my-profile', component: MyProfileComponent },
      { path: 'sale-team', redirectTo: 'employees', pathMatch: 'full' },
      { path: 'pr-team', redirectTo: 'employees', pathMatch: 'full' },
      { path: 'managers', redirectTo: 'employees', pathMatch: 'full' },
      { path: 'manage-employees', redirectTo: 'employees', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
