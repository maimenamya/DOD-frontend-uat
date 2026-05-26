import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { catchError, of } from 'rxjs';

import {
  CustomDropdownComponent,
  type DropdownOption,
} from '../../components/custom-dropdown/custom-dropdown.component';
import type { Employee } from '../../models/employee';
import type { Role } from '../../models/role';
import { AuthService } from '../../services/auth.service';
import { EmployeeService } from '../../services/employee.service';
import { RoleService } from '../../services/role.service';
import { TransactionService } from '../../services/transaction.service';
import { ToastService } from '../../services/toast.service';
import { hideActionOverlay, showActionOverlay } from '../../utils/action-overlay.util';
import { roleLabelThai } from '../../utils/employee-team.util';

type DrinkRowForm = FormGroup<{
  roleId: FormControl<number | ''>;
  employeeId: FormControl<string>;
  quantity: FormControl<number>;
}>;

/** Roles excluded from drink entry (no field billing). */
const EXCLUDED_DRINK_ROLE_NAMES = new Set(['OWNER']);

function rolesFromEmployees(employees: Employee[]): Role[] {
  const byId = new Map<number, Role>();
  for (const employee of employees) {
    const role = employee.role;
    if (!role || EXCLUDED_DRINK_ROLE_NAMES.has(role.name)) {
      continue;
    }
    if (!byId.has(role.id)) {
      byId.set(role.id, {
        id: role.id,
        name: role.name,
        category: role.category,
        startDrinks: role.startDrinks ?? 0,
        nextHourDrinks: role.nextHourDrinks ?? 0,
        defaultPricePerDrink: role.defaultPricePerDrink ?? 0,
      });
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.id - b.id);
}

function todayDateInputValue(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

@Component({
  selector: 'app-record-drinks-page',
  imports: [DecimalPipe, ReactiveFormsModule, CustomDropdownComponent],
  templateUrl: './record-drinks-page.component.html',
})
export class RecordDrinksPageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly employeeService = inject(EmployeeService);
  private readonly roleService = inject(RoleService);
  private readonly transactionService = inject(TransactionService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly staff = signal<Employee[]>([]);
  readonly allRoles = signal<Role[]>([]);

  readonly form = this.fb.group({
    saleEmployeeId: this.fb.control('', Validators.required),
    billReference: this.fb.control('', {
      validators: [Validators.required, Validators.maxLength(64)],
    }),
    billAmount: this.fb.control(0, {
      validators: [Validators.required, Validators.min(0)],
    }),
    businessDate: this.fb.control(todayDateInputValue(), Validators.required),
    rows: this.fb.array<DrinkRowForm>([]),
  });

  readonly saleDropdownOptions = computed((): DropdownOption[] =>
    this.staff()
      .filter((e) => e.role?.name === 'SALE')
      .map((e) => ({
        value: e.employeeId,
        label: e.nickname,
      })),
  );

  readonly roleDropdownOptions = computed((): DropdownOption[] => {
    return this.allRoles().map((role) => ({
      value: role.id,
      label: roleLabelThai(role.name),
    }));
  });

  readonly grandDrinks = signal(0);

  constructor() {
    effect(() => {
      if (this.submitting()) {
        showActionOverlay('กำลังบันทึกข้อมูล…');
      } else {
        hideActionOverlay();
      }
    });

    this.destroyRef.onDestroy(() => hideActionOverlay());
  }

  ngOnInit(): void {
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refreshSummary());

    this.refreshSummary();
    const shopId = this.auth.getShopId();
    if (!shopId) {
      this.loading.set(false);
      return;
    }

    this.employeeService.getEmployeesByShop(shopId).subscribe({
      next: (employees) => {
        const active = employees.filter((employee) => employee.status === 'Active');
        this.staff.set(active);
        this.allRoles.set(rolesFromEmployees(active));

        const saleEmployees = active.filter((e) => e.role?.name === 'SALE');
        if (saleEmployees.length > 0 && !this.form.controls.saleEmployeeId.value) {
          this.form.controls.saleEmployeeId.setValue(saleEmployees[0].employeeId);
        }

        this.roleService
          .getRolesForShop(shopId)
          .pipe(catchError(() => of(null)))
          .subscribe((roles) => {
            if (roles?.length) {
              this.allRoles.set(
                roles.filter((r) => !EXCLUDED_DRINK_ROLE_NAMES.has(r.name)),
              );
            } else if (this.allRoles().length === 0) {
              this.toast.showError('ไม่พบตำแหน่งที่มีพนักงานในร้านนี้');
            }
            this.loading.set(false);
            this.refreshSummary();
          });
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

  hasRoleSelected(row: DrinkRowForm): boolean {
    const roleId = Number(row.controls.roleId.value);
    return Number.isInteger(roleId) && roleId > 0;
  }

  employeeOptionsForRow(row: DrinkRowForm): DropdownOption[] {
    const roleId = Number(row.controls.roleId.value);
    if (!Number.isInteger(roleId) || roleId <= 0) {
      return [];
    }

    return this.staff()
      .filter((employee) => employee.roleId === roleId)
      .map((employee) => ({
        value: employee.employeeId,
        label: employee.nickname,
      }));
  }

  addRow(): void {
    const row = this.createRow();
    this.rows.push(row);
    this.syncEmployeeControlState(row);
    this.refreshSummary();
  }

  removeRow(index: number): void {
    this.rows.removeAt(index);
    this.syncAllRowsEmployeeState();
    this.refreshSummary();
  }

  lineAmount(row: DrinkRowForm): number {
    const qty = Number(row.controls.quantity.value);
    const roleId = Number(row.controls.roleId.value);
    const role = this.allRoles().find((item) => item.id === roleId);
    const price = role?.defaultPricePerDrink ?? 0;
    if (!Number.isFinite(price) || price <= 0 || qty <= 0) {
      return 0;
    }
    return Math.round(price * qty * 100) / 100;
  }

  lineAmountForRow(row: DrinkRowForm): number {
    return this.lineAmount(row);
  }

  submit(): void {
    for (const row of this.rows.controls) {
      if (row.controls.roleId.value) {
        row.controls.employeeId.enable({ emitEvent: false });
      }
    }

    const incompleteRow = this.rows.controls.find((row) => this.isRowPartial(row));
    if (incompleteRow) {
      this.markIncompleteRowErrors(incompleteRow);
      this.toast.showError('กรุณากรอกตำแหน่ง พนักงาน และจำนวนดื่มให้ครบทุกแถวที่เพิ่ม');
      this.reapplyEmployeeDisabledState();
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.showError('กรุณากรอกข้อมูลบิลให้ครบ');
      this.reapplyEmployeeDisabledState();
      return;
    }

    const raw = this.form.getRawValue();
    const billReference = raw.billReference.trim();
    const transactions = raw.rows
      .filter((row) => this.isRowCompleteValues(row))
      .map((row) => ({
        employeeId: row.employeeId,
        quantity: row.quantity,
        roleId: Number(row.roleId),
      }));

    this.submitting.set(true);
    this.transactionService
      .createBatchDrinks({
        billReference,
        saleEmployeeId: raw.saleEmployeeId.trim().toLowerCase(),
        billAmount: Number(raw.billAmount),
        businessDate: raw.businessDate,
        transactions,
      })
      .subscribe({
        next: (result) => {
          const drinkPart =
            result.count > 0
              ? `${result.count} รายการ, ${result.totalDrinks} ดื่ม`
              : 'ไม่มีรายการดื่ม';
          this.toast.showSuccess(
            `บันทึกบิล ${result.billReference} สำเร็จ — ยอดบิล ฿${result.billAmount.toLocaleString('th-TH')}, ${drinkPart}`,
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

  private refreshSummary(): void {
    let drinks = 0;
    for (const row of this.rows.controls) {
      drinks += Number(row.controls.quantity.value) || 0;
    }
    this.grandDrinks.set(drinks);
  }

  private reapplyEmployeeDisabledState(): void {
    this.syncAllRowsEmployeeState();
  }

  private resetForm(): void {
    const saleId = this.form.controls.saleEmployeeId.value;
    this.form.reset({
      saleEmployeeId: saleId,
      billReference: '',
      billAmount: 0,
      businessDate: todayDateInputValue(),
    });
    this.rows.clear();
    this.refreshSummary();
  }

  private syncAllRowsEmployeeState(): void {
    for (const row of this.rows.controls) {
      this.syncEmployeeControlState(row);
    }
  }

  private syncEmployeeControlState(row: DrinkRowForm): void {
    if (this.hasRoleSelected(row)) {
      row.controls.employeeId.enable({ emitEvent: false });
    } else {
      row.controls.employeeId.disable({ emitEvent: false });
      row.controls.employeeId.reset('', { emitEvent: false });
    }
  }

  private markIncompleteRowErrors(row: DrinkRowForm): void {
    row.markAllAsTouched();
    const roleId = Number(row.controls.roleId.value);
    if (!Number.isInteger(roleId) || roleId <= 0) {
      row.controls.roleId.setErrors({ required: true });
    }
    if (!row.controls.employeeId.value?.trim()) {
      row.controls.employeeId.setErrors({ required: true });
    }
    const qty = Number(row.controls.quantity.value);
    if (!Number.isFinite(qty) || qty < 1) {
      row.controls.quantity.setErrors({ min: { min: 1, actual: qty } });
    }
  }

  private isRowEmpty(row: DrinkRowForm): boolean {
    const roleId = row.controls.roleId.value;
    const employeeId = row.controls.employeeId.value?.trim();
    const qty = Number(row.controls.quantity.value);
    return !roleId && !employeeId && (!Number.isFinite(qty) || qty <= 0);
  }

  private isRowPartial(row: DrinkRowForm): boolean {
    return !this.isRowEmpty(row) && !this.isRowComplete(row);
  }

  private isRowComplete(row: DrinkRowForm): boolean {
    return this.isRowCompleteValues(row.getRawValue());
  }

  private isRowCompleteValues(row: {
    roleId: number | '';
    employeeId: string;
    quantity: number;
  }): boolean {
    const roleId = Number(row.roleId);
    const employeeId = row.employeeId?.trim();
    const qty = Number(row.quantity);
    return (
      Number.isInteger(roleId) &&
      roleId > 0 &&
      !!employeeId &&
      Number.isFinite(qty) &&
      qty >= 1
    );
  }

  private createRow(): DrinkRowForm {
    const row = this.fb.group({
      roleId: this.fb.control<number | ''>(''),
      employeeId: this.fb.control({ value: '', disabled: true }),
      quantity: this.fb.control(0, {
        validators: [Validators.min(0), Validators.max(999)],
      }),
    });

    row.controls.roleId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        row.patchValue({ employeeId: '' }, { emitEvent: false });
        this.syncEmployeeControlState(row);
        this.refreshSummary();
      });

    row.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.refreshSummary());

    return row;
  }
}
