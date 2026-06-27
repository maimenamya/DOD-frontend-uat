import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './guards/auth.guard';
import { mustChangePasswordChildGuard } from './guards/must-change-password.guard';
import { permissionGuard } from './guards/permission.guard';
import { openTableGuard } from './guards/open-table.guard';
import { saleSelfBillGuard } from './guards/sale-self-bill.guard';
import { MainShellComponent } from './layouts/main-shell/main-shell.component';
import { DashboardPageComponent } from './pages/dashboard/dashboard-page.component';
import { EmployeeManagementPageComponent } from './pages/employee-management/employee-management-page.component';
import { LoginComponent } from './pages/login/login.component';
import { MasterBeverageCategoryPageComponent } from './pages/master-beverage-category/master-beverage-category-page.component';
import { MasterDrinkPageComponent } from './pages/master-drink/master-drink-page.component';
import { MasterCocktailPageComponent } from './pages/master-cocktail/master-cocktail-page.component';
import { MasterFoodCategoryPageComponent } from './pages/master-food-category/master-food-category-page.component';
import { MasterFoodPageComponent } from './pages/master-food/master-food-page.component';
import { MasterMembershipPageComponent } from './pages/master-membership/master-membership-page.component';
import { MasterOtherChargePageComponent } from './pages/master-other-charge/master-other-charge-page.component';
import { MasterPrTagPageComponent } from './pages/master-pr-tag/master-pr-tag-page.component';
import { PrTagOperationsPageComponent } from './pages/pr-tag-operations/pr-tag-operations-page.component';
import { DrinkPayoutPageComponent } from './pages/drink-payout/drink-payout-page.component';
import { MasterPromotionPageComponent } from './pages/master-promotion/master-promotion-page.component';
import { MasterRolePageComponent } from './pages/master-role/master-role-page.component';
import { MasterSeatingListPageComponent } from './pages/master-seating-list/master-seating-list-page.component';
import { MasterSeatingTypePageComponent } from './pages/master-seating-type/master-seating-type-page.component';
import { MyProfileComponent } from './pages/my-profile/my-profile.component';
import { OpenTablePageComponent } from './pages/open-table/open-table-page.component';
import { ReportsPageComponent } from './pages/reports/reports-page.component';
import { DailyExpensesPageComponent } from './pages/daily-expenses/daily-expenses-page.component';
import { ShopRulesPageComponent } from './pages/shop-rules/shop-rules-page.component';
import { ReceiptPrinterPageComponent } from './pages/receipt-printer/receipt-printer-page.component';
import { PackageDepositPageComponent } from './pages/package-deposit/package-deposit-page.component';
import { StockPageComponent } from './pages/stock/stock-page.component';
import { AttendanceKioskPageComponent } from './pages/attendance-kiosk/attendance-kiosk-page.component';
import { AttendancePunchPageComponent } from './pages/attendance-punch/attendance-punch-page.component';
import { AttendanceLogsPageComponent } from './pages/attendance-logs/attendance-logs-page.component';
import { attendancePunchGuard } from './guards/attendance-punch.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 's/:shopPublicId/login',
    component: LoginComponent,
    canActivate: [guestGuard],
  },
  {
    path: 's/:shopPublicId/attendance-kiosk',
    component: AttendanceKioskPageComponent,
  },
  {
    path: 's/:shopPublicId/attendance/punch',
    component: AttendancePunchPageComponent,
    canActivate: [attendancePunchGuard],
  },
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [guestGuard],
  },
  {
    path: 'dashboard',
    component: MainShellComponent,
    canActivate: [authGuard],
    canActivateChild: [mustChangePasswordChildGuard],
    children: [
      { path: '', component: DashboardPageComponent },
      {
        path: 'my-bills',
        component: OpenTablePageComponent,
        canActivate: [saleSelfBillGuard],
      },
      {
        path: 'open-table',
        component: OpenTablePageComponent,
        canActivate: [openTableGuard],
      },
      {
        path: 'employees',
        component: EmployeeManagementPageComponent,
        canActivate: [permissionGuard('manage_employees')],
      },
      {
        path: 'attendance-logs',
        component: AttendanceLogsPageComponent,
        canActivate: [permissionGuard('manage_employees')],
      },
      {
        path: 'master-roles',
        component: MasterRolePageComponent,
        canActivate: [permissionGuard('manage_roles')],
      },
      {
        path: 'master-beverage-categories',
        component: MasterBeverageCategoryPageComponent,
        canActivate: [permissionGuard('master_data')],
      },
      {
        path: 'master-drinks',
        component: MasterDrinkPageComponent,
        canActivate: [permissionGuard('master_data')],
      },
      {
        path: 'master-cocktails',
        component: MasterCocktailPageComponent,
        canActivate: [permissionGuard('master_data')],
      },
      {
        path: 'master-food-categories',
        component: MasterFoodCategoryPageComponent,
        canActivate: [permissionGuard('master_data')],
      },
      {
        path: 'master-foods',
        component: MasterFoodPageComponent,
        canActivate: [permissionGuard('master_data')],
      },
      {
        path: 'master-seatings',
        component: MasterSeatingListPageComponent,
        canActivate: [permissionGuard('master_data')],
      },
      {
        path: 'master-seating-types',
        component: MasterSeatingTypePageComponent,
        canActivate: [permissionGuard('master_data')],
      },
      { path: 'master-seating-price-types', redirectTo: 'open-table', pathMatch: 'full' },
      { path: 'master-seating-prices', redirectTo: 'open-table', pathMatch: 'full' },
      { path: 'record-drinks', redirectTo: 'open-table', pathMatch: 'full' },
      { path: 'master-tables', redirectTo: 'master-seatings', pathMatch: 'full' },
      { path: 'master-rooms', redirectTo: 'master-seating-types', pathMatch: 'full' },
      {
        path: 'master-promotions',
        component: MasterPromotionPageComponent,
        canActivate: [permissionGuard('master_data')],
      },
      {
        path: 'master-memberships',
        component: MasterMembershipPageComponent,
        canActivate: [permissionGuard('master_data')],
      },
      {
        path: 'package-deposits',
        component: PackageDepositPageComponent,
        canActivate: [permissionGuard('open_table')],
      },
      {
        path: 'master-other-charges',
        component: MasterOtherChargePageComponent,
        canActivate: [permissionGuard('master_data')],
      },
      {
        path: 'master-pr-tags',
        component: MasterPrTagPageComponent,
        canActivate: [permissionGuard('master_data')],
      },
      {
        path: 'pr-tag-operations',
        component: PrTagOperationsPageComponent,
        canActivate: [permissionGuard('pr_tag_operations')],
      },
      {
        path: 'drink-payout',
        component: DrinkPayoutPageComponent,
        canActivate: [permissionGuard('drink_payout')],
      },
      {
        path: 'reports',
        component: ReportsPageComponent,
        canActivate: [permissionGuard('reports')],
      },
      {
        path: 'daily-expenses',
        component: DailyExpensesPageComponent,
        canActivate: [permissionGuard('daily_expenses')],
      },
      {
        path: 'stock',
        component: StockPageComponent,
        canActivate: [permissionGuard('master_data')],
      },
      {
        path: 'shop-rules',
        component: ShopRulesPageComponent,
        canActivate: [permissionGuard('master_data')],
      },
      {
        path: 'receipt-printer',
        component: ReceiptPrinterPageComponent,
        canActivate: [permissionGuard('master_data')],
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
