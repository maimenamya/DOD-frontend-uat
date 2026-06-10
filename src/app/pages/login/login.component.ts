import { Component, inject, signal } from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';

import type { AuthBranchOption } from '../../models/auth';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly showPassword = signal(false);
  readonly branchStep = signal(false);
  readonly branches = signal<AuthBranchOption[]>([]);

  private pendingUsername = '';
  private pendingPassword = '';

  readonly form = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const { username, password } = this.form.getRawValue();
    this.pendingUsername = username;
    this.pendingPassword = password;

    this.auth.login({ username, password }).subscribe({
      next: (response) => {
        if (response.needsBranchSelection && response.branches?.length) {
          this.branches.set(response.branches);
          this.branchStep.set(true);
          this.loading.set(false);
          return;
        }
        this.finishLogin();
      },
      error: (err: { error?: { error?: string } }) => {
        this.loading.set(false);
        this.error.set(err.error?.error ?? 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่');
      },
    });
  }

  selectBranch(shopId: number): void {
    this.loading.set(true);
    this.error.set(null);

    this.auth
      .login({
        username: this.pendingUsername,
        password: this.pendingPassword,
        shopId,
      })
      .subscribe({
        next: () => this.finishLogin(),
        error: (err: { error?: { error?: string } }) => {
          this.loading.set(false);
          this.error.set(err.error?.error ?? 'เลือกสาขาไม่สำเร็จ กรุณาลองใหม่');
        },
      });
  }

  backToCredentials(): void {
    this.branchStep.set(false);
    this.branches.set([]);
    this.error.set(null);
  }

  branchOptionLabel(branch: AuthBranchOption): string {
    const name = branch.branchName?.trim() || branch.branchCode;
    const role = branch.roleDisplayNameTh?.trim() || branch.roleName;
    return `${name} (${role})`;
  }

  private finishLogin(): void {
    this.auth.fetchAccessibleBranches().subscribe({
      next: () => {
        this.loading.set(false);
        void this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.loading.set(false);
        void this.router.navigate(['/dashboard']);
      },
    });
  }
}
