import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  highlightInvalidForm,
} from '../../utils/form-validation.util';
import { Router } from '@angular/router';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import {
  MIN_PASSWORD_LENGTH,
  passwordMeetsPolicy,
  passwordPolicyErrorMessage,
} from '../../utils/password-policy.util';

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
  readonly forcePasswordChange = computed(() => this.auth.needsPasswordChange());
  readonly submitting = signal(false);
  readonly formValidated = signal(false);

  readonly form = this.fb.group({
    nickname: ['', [Validators.required, Validators.minLength(1)]],
    email: [''],
    password: [''],
    confirmPassword: [''],
  });

  ngOnInit(): void {
    const user = this.user;
    if (user) {
      this.form.patchValue({
        nickname: user.nickname,
        email: user.email ?? '',
        password: '',
        confirmPassword: '',
      });
    }

    if (this.forcePasswordChange()) {
      this.form.controls.password.setValidators([
        Validators.required,
        Validators.minLength(MIN_PASSWORD_LENGTH),
      ]);
      this.form.controls.confirmPassword.setValidators([
        Validators.required,
        Validators.minLength(MIN_PASSWORD_LENGTH),
      ]);
    }
  }

  submit(): void {
    if (highlightInvalidForm(this.form, this.formValidated, this.toast)) return;

    const raw = this.form.getRawValue();
    const password = raw.password.trim();
    const confirmPassword = raw.confirmPassword.trim();

    if (this.forcePasswordChange()) {
      if (!password) {
        this.toast.showError('กรุณาตั้งรหัสผ่านใหม่');
        return;
      }
      if (password !== confirmPassword) {
        this.formValidated.set(true);
        this.toast.showError('รหัสผ่านไม่ตรงกัน');
        return;
      }
    } else if (password && !passwordMeetsPolicy(password)) {
      this.formValidated.set(true);
      this.form.controls.password.markAsTouched();
      this.toast.showError(passwordPolicyErrorMessage());
      return;
    } else if (password && password !== confirmPassword) {
      this.formValidated.set(true);
      this.toast.showError('รหัสผ่านไม่ตรงกัน');
      return;
    }

    this.submitting.set(true);
    const wasForcedPasswordChange = this.forcePasswordChange();

    this.auth
      .updateProfile({
        nickname: raw.nickname,
        email: raw.email || null,
        password: password || undefined,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.toast.showSuccess(
            wasForcedPasswordChange
              ? 'ตั้งรหัสผ่านเรียบร้อย'
              : 'บันทึกโปรไฟล์เรียบร้อย',
          );
          this.auth.fetchAccessibleBranches().subscribe({
            next: () => void this.router.navigate([this.auth.homePathAfterLogin()]),
            error: () => void this.router.navigate([this.auth.homePathAfterLogin()]),
          });
        },
        error: (err: { error?: { error?: string } }) => {
          this.submitting.set(false);
          this.toast.showError(err.error?.error ?? 'ไม่สามารถอัปเดตโปรไฟล์ได้');
        },
      });
  }
}
