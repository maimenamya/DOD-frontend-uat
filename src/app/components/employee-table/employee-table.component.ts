import { Component, input } from '@angular/core';
import type { MstEmployee } from '../../models/employee';

@Component({
  selector: 'app-employee-table',
  templateUrl: './employee-table.component.html',
})
export class EmployeeTableComponent {
  readonly employees = input.required<MstEmployee[]>();
}

