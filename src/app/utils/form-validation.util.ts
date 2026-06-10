import type { WritableSignal } from '@angular/core';
import { AbstractControl, FormArray, FormGroup } from '@angular/forms';

export const FORM_INVALID_TOAST = 'กรุณากรอกข้อมูลให้ครบถ้วน';

export interface FormInvalidToast {
  showError(message: string): void;
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
 * On invalid form: touch all fields, enable red borders (via app-form-was-validated), toast.
 * @returns true when submit should abort.
 */
export function highlightInvalidForm(
  form: AbstractControl,
  validated: WritableSignal<boolean>,
  toast?: FormInvalidToast,
  message = FORM_INVALID_TOAST,
): boolean {
  if (form.valid) {
    validated.set(false);
    return false;
  }
  markAllControlsTouched(form);
  validated.set(true);
  toast?.showError(message);
  return true;
}

export function showControlError(
  control: AbstractControl | null | undefined,
  validated: boolean,
): boolean {
  if (!control) return false;
  return control.invalid && (control.touched || control.dirty || validated);
}

export function controlErrorMessage(control: AbstractControl | null | undefined): string | null {
  if (!control?.errors) return null;
  const errors = control.errors;
  if (errors['required']) return 'กรุณากรอกข้อมูล';
  if (errors['minlength']) {
    return `อย่างน้อย ${errors['minlength'].requiredLength} ตัวอักษร`;
  }
  if (errors['maxlength']) {
    return `ไม่เกิน ${errors['maxlength'].requiredLength} ตัวอักษร`;
  }
  if (errors['min']) return 'ค่าน้อยเกินไป';
  if (errors['max']) return 'ค่ามากเกินไป';
  if (errors['email']) return 'รูปแบบอีเมลไม่ถูกต้อง';
  if (errors['pattern']) return 'รูปแบบไม่ถูกต้อง';
  return 'ข้อมูลไม่ถูกต้อง';
}
