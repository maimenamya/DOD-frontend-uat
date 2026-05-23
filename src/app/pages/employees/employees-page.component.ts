import { Component, OnInit, inject, signal } from '@angular/core';
import type { Employee } from '../../models/employee';
import { EmployeeService } from '../../services/employee.service';
import { EmployeeTableComponent } from '../../components/employee-table/employee-table.component';

@Component({
  selector: 'app-employees-page',
  imports: [EmployeeTableComponent],
  templateUrl: './employees-page.component.html',
})
export class EmployeesPageComponent implements OnInit {
  private readonly employeeService = inject(EmployeeService);

  readonly employees = signal<Employee[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.employeeService.getEmployees().subscribe({
      next: (data) => {
        this.employees.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('ไม่สามารถโหลดข้อมูลพนักงานได้ ตรวจสอบว่า Backend รันที่พอร์ต 3000');
        this.loading.set(false);
      },
    });
  }
}

