import { Component, OnInit, inject, signal } from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-my-profile',
  imports: [ReactiveFormsModule],
  templateUrl: './my-profile.component.html',
})
export class MyProfileComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);

  readonly user = this.auth.getUser();
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    nickname: ['', Validators.required],
    email: [''],
    password: [''],
  });

  ngOnInit(): void {
    const user = this.user;
    if (user) {
      this.form.patchValue({
        name: user.name,
        nickname: user.nickname,
        email: user.email ?? '',
        password: '',
      });
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    if (raw.password && raw.password.length < 6) {
      this.error.set('Password must be at least 6 characters');
      return;
    }

    this.submitting.set(true);
    this.error.set(null);
    this.success.set(null);

    this.auth
      .updateProfile({
        name: raw.name,
        nickname: raw.nickname,
        email: raw.email || null,
        password: raw.password || undefined,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.success.set('Profile updated successfully');
          this.form.patchValue({ password: '' });
        },
        error: (err: { error?: { error?: string } }) => {
          this.submitting.set(false);
          this.error.set(err.error?.error ?? 'Could not update profile');
        },
      });
  }
}
