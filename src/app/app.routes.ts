import { Routes } from '@angular/router';

import { authGuard, guestGuard, teamManagementGuard } from './guards/auth.guard';
import { MainShellComponent } from './layouts/main-shell/main-shell.component';
import { DashboardPageComponent } from './pages/dashboard/dashboard-page.component';
import { EmployeeManagementPageComponent } from './pages/employee-management/employee-management-page.component';
import { LoginComponent } from './pages/login/login.component';
import { MasterCocktailPageComponent } from './pages/master-cocktail/master-cocktail-page.component';
import { MasterDrinkPageComponent } from './pages/master-drink/master-drink-page.component';
import { MasterFoodCategoryPageComponent } from './pages/master-food-category/master-food-category-page.component';
import { MasterFoodPageComponent } from './pages/master-food/master-food-page.component';
import { MasterMembershipPageComponent } from './pages/master-membership/master-membership-page.component';
import { MasterOtherChargePageComponent } from './pages/master-other-charge/master-other-charge-page.component';
import { MasterPrTagPageComponent } from './pages/master-pr-tag/master-pr-tag-page.component';
import { PrTagOperationsPageComponent } from './pages/pr-tag-operations/pr-tag-operations-page.component';
import { MasterPromotionPageComponent } from './pages/master-promotion/master-promotion-page.component';
import { MasterRolePageComponent } from './pages/master-role/master-role-page.component';
import { MasterSeatingListPageComponent } from './pages/master-seating-list/master-seating-list-page.component';
import { MasterSeatingTypePageComponent } from './pages/master-seating-type/master-seating-type-page.component';
import { MyProfileComponent } from './pages/my-profile/my-profile.component';
import { OpenTablePageComponent } from './pages/open-table/open-table-page.component';
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
        path: 'open-table',
        component: OpenTablePageComponent,
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
      {
        path: 'master-cocktails',
        component: MasterCocktailPageComponent,
        canActivate: [teamManagementGuard],
      },
      {
        path: 'master-food-categories',
        component: MasterFoodCategoryPageComponent,
        canActivate: [teamManagementGuard],
      },
      {
        path: 'master-foods',
        component: MasterFoodPageComponent,
        canActivate: [teamManagementGuard],
      },
      {
        path: 'master-seatings',
        component: MasterSeatingListPageComponent,
        canActivate: [teamManagementGuard],
      },
      {
        path: 'master-seating-types',
        component: MasterSeatingTypePageComponent,
        canActivate: [teamManagementGuard],
      },
      { path: 'record-drinks', redirectTo: 'open-table', pathMatch: 'full' },
      { path: 'master-tables', redirectTo: 'master-seatings', pathMatch: 'full' },
      { path: 'master-rooms', redirectTo: 'master-seating-types', pathMatch: 'full' },
      {
        path: 'master-promotions',
        component: MasterPromotionPageComponent,
        canActivate: [teamManagementGuard],
      },
      {
        path: 'master-memberships',
        component: MasterMembershipPageComponent,
        canActivate: [teamManagementGuard],
      },
      {
        path: 'master-other-charges',
        component: MasterOtherChargePageComponent,
        canActivate: [teamManagementGuard],
      },
      {
        path: 'master-pr-tags',
        component: MasterPrTagPageComponent,
        canActivate: [teamManagementGuard],
      },
      {
        path: 'pr-tag-operations',
        component: PrTagOperationsPageComponent,
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
