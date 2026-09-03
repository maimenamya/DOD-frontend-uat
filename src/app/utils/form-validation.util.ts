import type { WritableSignal } from '@angular/core';
import { AbstractControl, FormArray, FormGroup } from '@angular/forms';

/** Placeholder for optional empty fields (Thai-first). */
export const OPTIONAL_FIELD_PLACEHOLDER = '(ไม่จำเป็นต้องระบุ)';

export interface ControlErrorMessageOptions {
  label?: string;
  select?: boolean;
}

/** Mark every control in the tree touched (shows ng-invalid after submit attempt). */
export function markAllControlsTouched(control: AbstractControl): void {
  control.markAsTouched({ onlySelf: true });
  if (control instanceof FormGroup) {
    for (const child of Object.values(control.controls)) {
      markAllControlsTouched(child);
    }
  } else if (control instanceof FormArray) {
    for (const child of control.controls) {
      markAllControlsTouched(child);
    }
  }
}

export function resetFormValidationFlag(validated: WritableSignal<boolean>): void {
  validated.set(false);
}

/**
 * On invalid form: touch all fields and enable red borders (`app-form-was-validated`).
 * Messages belong under each field via `<app-field-error>` — do not toast.
 * @returns true when submit should abort.
 */
export function highlightInvalidForm(
  form: AbstractControl,
  validated: WritableSignal<boolean>,
): boolean {
  if (form.valid) {
    validated.set(false);
    return false;
  }
  markAllControlsTouched(form);
  validated.set(true);
  return true;
}

export function showControlError(
  control: AbstractControl | null | undefined,
  validated: boolean,
): boolean {
  if (!control) return false;
  return control.invalid && (control.touched || control.dirty || validated);
}

export function controlErrorMessage(
  control: AbstractControl | null | undefined,
  options?: ControlErrorMessageOptions,
): string | null {
  if (!control?.errors) return null;
  const errors = control.errors;
  const label = options?.label?.trim();
  if (errors['required']) {
    if (label) {
      return options?.select ? `กรุณาเลือก${label}` : `กรุณากรอก${label}`;
    }
    return 'กรุณากรอกข้อมูลนี้';
  }
  if (errors['minlength']) {
    return `อย่างน้อย ${errors['minlength'].requiredLength} ตัวอักษร`;
  }
  if (errors['maxlength']) {
    return `ไม่เกิน ${errors['maxlength'].requiredLength} ตัวอักษร`;
  }
  if (errors['min']) return 'ค่าน้อยเกินไป';
  if (errors['max']) return 'ค่ามากเกินไป';
  if (errors['mismatch']) return 'รหัสผ่านไม่ตรงกัน';
  if (errors['passwordPolicy']) {
    return typeof errors['passwordPolicy'] === 'string'
      ? errors['passwordPolicy']
      : (errors['passwordPolicy'].message ?? 'รหัสผ่านไม่ตรงตามกฎ');
  }
  if (errors['email']) return 'รูปแบบอีเมลไม่ถูกต้อง';
  if (errors['timeFormat']) return 'ต้องเป็นรูปแบบ 24 ชม. เช่น 20:00';
  if (errors['duplicate']) return 'เวลาซ้ำกับรอบอื่น';
  if (errors['pattern']) return 'รูปแบบไม่ถูกต้อง';
  return 'ข้อมูลไม่ถูกต้อง';
}
