import { Component, OnInit, inject, signal } from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { AuthService } from '../../services/auth.service';
import { ConfigService } from '../../services/config.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-my-profile',
  imports: [ReactiveFormsModule],
  templateUrl: './my-profile.component.html',
})
export class MyProfileComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly configService = inject(ConfigService);
  private readonly toast = inject(ToastService);

  readonly user = this.auth.getUser();
  readonly submitting = signal(false);
  readonly lineOaAddFriendUrl = signal<string | null>(null);

  readonly form = this.fb.group({
    nickname: ['', [Validators.required, Validators.minLength(1)]],
    email: [''],
    lineUserId: [''],
    password: [''],
  });

  ngOnInit(): void {
    const user = this.user;
    if (user) {
      this.form.patchValue({
        nickname: user.nickname,
        email: user.email ?? '',
        lineUserId: user.lineUserId ?? '',
        password: '',
      });
    }

    this.configService.getClientConfig().subscribe((cfg) => {
      this.lineOaAddFriendUrl.set(cfg.lineOaAddFriendUrl);
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    if (raw.password && raw.password.length < 6) {
      this.toast.showError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }

    this.submitting.set(true);

    this.auth
      .updateProfile({
        nickname: raw.nickname,
        email: raw.email || null,
        lineUserId: raw.lineUserId.trim() || null,
        password: raw.password || undefined,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.toast.showSuccess('บันทึกโปรไฟล์เรียบร้อย');
          this.form.patchValue({ password: '' });
        },
        error: (err: { error?: { error?: string } }) => {
          this.submitting.set(false);
          this.toast.showError(err.error?.error ?? 'ไม่สามารถอัปเดตโปรไฟล์ได้');
        },
      });
  }
}
