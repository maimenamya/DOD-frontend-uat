import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import {
  CustomDropdownComponent,
  type DropdownOption,
} from '../../components/custom-dropdown/custom-dropdown.component';
import type { Employee } from '../../models/employee';
import { FIELD_STAFF_ROLES } from '../../models/role';
import { AuthService } from '../../services/auth.service';
import { EmployeeService } from '../../services/employee.service';
import { TransactionService } from '../../services/transaction.service';
import { ToastService } from '../../services/toast.service';
import { roleLabelThai } from '../../utils/employee-team.util';

export type DrinkStaffTeam = 'SALE' | 'PR';

type DrinkRowForm = FormGroup<{
  staffTeam: FormControl<DrinkStaffTeam | ''>;
  employeeId: FormControl<string>;
  quantity: FormControl<number>;
}>;

@Component({
  selector: 'app-record-drinks-page',
  imports: [DecimalPipe, ReactiveFormsModule, CustomDropdownComponent],
  templateUrl: './record-drinks-page.component.html',
})
export class RecordDrinksPageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly employeeService = inject(EmployeeService);
  private readonly transactionService = inject(TransactionService);
  private readonly toast = inject(ToastService);

  readonly user = computed(() => this.auth.getUser());
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly staff = signal<Employee[]>([]);

  readonly staffTeamChoices: { value: DrinkStaffTeam; label: string }[] = [
    { value: 'SALE', label: 'ฝ่ายขาย (Sale)' },
    { value: 'PR', label: 'พีอาร์ (PR)' },
  ];

  readonly form = this.fb.group({
    billReference: this.fb.control('', {
      validators: [Validators.required, Validators.maxLength(64)],
    }),
    rows: this.fb.array<DrinkRowForm>([this.createRow()]),
  });

  readonly grandTotal = computed(() => {
    const map = this.staffByEmployeeId();
    let total = 0;
    for (const row of this.rows.controls) {
      total += this.lineAmount(row, map);
    }
    return total;
  });

  readonly grandDrinks = computed(() => {
    let total = 0;
    for (const row of this.rows.controls) {
      total += row.controls.quantity.value;
    }
    return total;
  });

  ngOnInit(): void {
    const shopId = this.auth.getShopId();
    if (!shopId) {
      this.loading.set(false);
      return;
    }

    this.employeeService.getEmployeesByShop(shopId).subscribe({
      next: (employees) => {
        const eligible = employees.filter(
          (e) =>
            e.status === 'Active' &&
            e.role?.name &&
            FIELD_STAFF_ROLES.includes(e.role.name),
        );
        this.staff.set(eligible);
        this.loading.set(false);
      },
      error: () => {
        this.toast.showError('โหลดรายชื่อพนักงานไม่สำเร็จ');
        this.loading.set(false);
      },
    });
  }

  get rows(): FormArray<DrinkRowForm> {
    return this.form.controls.rows;
  }

  employeeOptionsForRow(index: number): DropdownOption[] {
    const row = this.rows.at(index);
    const team = row?.controls.staffTeam.value;
    if (!team) {
      return [];
    }

    return this.staff()
      .filter((employee) => employee.role?.name === team)
      .map((employee) => ({
        value: employee.employeeId,
        label: employee.nickname,
      }));
  }

  isRowTeamSelected(index: number, team: DrinkStaffTeam): boolean {
    return this.rows.at(index)?.controls.staffTeam.value === team;
  }

  setRowTeam(index: number, team: DrinkStaffTeam): void {
    const row = this.rows.at(index);
    if (!row) {
      return;
    }

    row.patchValue({ staffTeam: team, employeeId: '' });
    row.controls.employeeId.enable();
    row.controls.employeeId.markAsUntouched();
  }

  addRow(): void {
    this.rows.push(this.createRow());
  }

  removeRow(index: number): void {
    if (this.rows.length <= 1) {
      return;
    }
    this.rows.removeAt(index);
  }

  lineAmount(row: DrinkRowForm, map?: Map<string, Employee>): number {
    const staffMap = map ?? this.staffByEmployeeId();
    const employee = staffMap.get(row.controls.employeeId.value);
    const price = employee?.role?.defaultPricePerDrink ?? 0;
    const qty = row.controls.quantity.value;
    if (!price || qty <= 0) {
      return 0;
    }
    return Math.round(price * qty * 100) / 100;
  }

  lineAmountForIndex(index: number): number {
    const row = this.rows.at(index);
    return row ? this.lineAmount(row) : 0;
  }

  submit(): void {
    for (const row of this.rows.controls) {
      if (row.controls.staffTeam.value) {
        row.controls.employeeId.enable({ emitEvent: false });
      }
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.showError('กรุณากรอกเลขบิล เลือกฝ่าย และเลือกพนักงานทุกแถว');
      for (const row of this.rows.controls) {
        if (!row.controls.staffTeam.value) {
          row.controls.employeeId.disable({ emitEvent: false });
        }
      }
      return;
    }

    const billReference = this.form.controls.billReference.value.trim();
    const transactions = this.rows.getRawValue().map((row) => ({
      employeeId: row.employeeId,
      quantity: row.quantity,
    }));

    this.submitting.set(true);
    this.transactionService
      .createBatchDrinks({ billReference, transactions })
      .subscribe({
        next: (result) => {
          this.toast.showSuccess(
            `บันทึกบิล ${result.billReference} สำเร็จ — ${result.count} รายการ, รวม ${result.totalDrinks} ดื่ม, ฿${result.totalAmount.toLocaleString('th-TH')}`,
          );
          this.resetForm();
          this.submitting.set(false);
        },
        error: (err) => {
          const message =
            err?.error?.error ??
            'บันทึกไม่สำเร็จ — ตรวจสอบราคาต่อดื่มของตำแหน่งและข้อมูลพนักงาน';
          this.toast.showError(message);
          this.submitting.set(false);
          this.reapplyEmployeeDisabledState();
        },
      });
  }

  private reapplyEmployeeDisabledState(): void {
    for (const row of this.rows.controls) {
      if (!row.controls.staffTeam.value) {
        row.controls.employeeId.disable({ emitEvent: false });
      }
    }
  }

  private resetForm(): void {
    this.form.controls.billReference.reset('');
    this.rows.clear();
    this.rows.push(this.createRow());
  }

  private createRow(): DrinkRowForm {
    const row = this.fb.group({
      staffTeam: this.fb.control<DrinkStaffTeam | ''>('', {
        validators: [Validators.required],
      }),
      employeeId: this.fb.control({ value: '', disabled: true }, { validators: [Validators.required] }),
      quantity: this.fb.control(1, {
        validators: [Validators.required, Validators.min(1), Validators.max(999)],
      }),
    });
    return row;
  }

  private staffByEmployeeId(): Map<string, Employee> {
    return new Map(this.staff().map((e) => [e.employeeId, e]));
  }
}
