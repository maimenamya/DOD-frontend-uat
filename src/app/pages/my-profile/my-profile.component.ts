import { Component, OnInit, inject, signal } from '@angular/core';
import {
  highlightInvalidForm,
  resetFormValidationFlag,
} from '../../utils/form-validation.util';
import { Router } from '@angular/router';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-my-profile',
  imports: [ReactiveFormsModule],
  templateUrl: './my-profile.component.html',
})
export class MyProfileComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly user = this.auth.getUser();
  readonly submitting = signal(false);
  readonly formValidated = signal(false);

  readonly form = this.fb.group({
    nickname: ['', [Validators.required, Validators.minLength(1)]],
    email: [''],
    password: [''],
  });

  ngOnInit(): void {
    const user = this.user;
    if (user) {
      this.form.patchValue({
        nickname: user.nickname,
        email: user.email ?? '',
        password: '',
      });
    }
  }

  submit(): void {
    if (highlightInvalidForm(this.form, this.formValidated, this.toast)) return;

    const raw = this.form.getRawValue();
    if (raw.password && raw.password.length < 6) {
      this.formValidated.set(true);
      this.form.controls.password.markAsTouched();
      this.toast.showError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }

    this.submitting.set(true);

    this.auth
      .updateProfile({
        nickname: raw.nickname,
        email: raw.email || null,
        password: raw.password || undefined,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.toast.showSuccess('บันทึกโปรไฟล์เรียบร้อย');
          void this.router.navigate(['/dashboard']);
        },
        error: (err: { error?: { error?: string } }) => {
          this.submitting.set(false);
          this.toast.showError(err.error?.error ?? 'ไม่สามารถอัปเดตโปรไฟล์ได้');
        },
      });
  }
}
