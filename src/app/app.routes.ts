import { Routes } from '@angular/router';
import { EmployeesPageComponent } from './pages/employees/employees-page.component';
import { ResourcesPageComponent } from './pages/resources/resources-page.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'employees' },
  { path: 'employees', component: EmployeesPageComponent },
  { path: 'resources', component: ResourcesPageComponent },
  { path: '**', redirectTo: 'employees' },
];
