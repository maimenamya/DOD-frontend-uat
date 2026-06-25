import { Component, inject, OnInit, signal } from '@angular/core';
import {
  highlightInvalidForm,
  showControlError,
} from '../../utils/form-validation.util';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { readStoredShopPublicId, writeStoredShopPublicId } from '../../core/shop-public-id.storage';
import { AuthService } from '../../services/auth.service';
import {
  ShopPublicService,
  type ShopPublicInfo,
} from '../../services/shop-public.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent implements OnInit {
  protected readonly showControlError = showControlError;

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly shopPublic = inject(ShopPublicService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly shopPublicIdParam = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('shopPublicId')?.trim() ?? '')),
    { initialValue: '' },
  );

  readonly loading = signal(false);
  readonly formValidated = signal(false);
  readonly error = signal<string | null>(null);
  readonly showPassword = signal(false);
  readonly shopInfo = signal<ShopPublicInfo | null>(null);
  readonly shopLoadError = signal<string | null>(null);
  readonly missingShopLink = signal(false);

  readonly form = this.fb.group({
    employeeId: ['', [Validators.required, Validators.minLength(2)]],
    password: ['', [Validators.required]],
  });

  ngOnInit(): void {
    const publicId = this.shopPublicIdParam();
    if (!publicId) {
      const last = readStoredShopPublicId();
      if (last) {
        void this.router.navigate(['/s', last, 'login'], { replaceUrl: true });
        return;
      }
      this.missingShopLink.set(true);
      return;
    }

    writeStoredShopPublicId(publicId);

    this.loading.set(true);
    this.shopPublic.getByPublicId(publicId).subscribe({
      next: (shop) => {
        this.shopInfo.set(shop);
        this.shopLoadError.set(null);
        this.loading.set(false);
      },
      error: () => {
        this.shopLoadError.set('ไม่พบร้านจากลิงก์นี้ กรุณาติดต่อเจ้าของร้าน');
        this.loading.set(false);
      },
    });
  }

  togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  submit(): void {
    const shopPublicId = this.shopPublicIdParam();
    if (!shopPublicId || this.shopLoadError()) {
      return;
    }
    if (highlightInvalidForm(this.form, this.formValidated)) return;

    this.loading.set(true);
    this.error.set(null);

    const { employeeId, password } = this.form.getRawValue();

    this.auth.login({ shopPublicId, employeeId, password }).subscribe({
      next: () => this.finishLogin(),
      error: (err: { error?: { error?: string } }) => {
        this.loading.set(false);
        this.error.set(err.error?.error ?? 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่');
      },
    });
  }

  private finishLogin(): void {
    if (this.auth.needsPasswordChange()) {
      this.loading.set(false);
      void this.router.navigate(['/dashboard/my-profile']);
      return;
    }

    this.auth.fetchAccessibleBranches().subscribe({
      next: () => {
        this.loading.set(false);
        void this.router.navigate([this.auth.homePathAfterLogin()]);
      },
      error: () => {
        this.loading.set(false);
        void this.router.navigate([this.auth.homePathAfterLogin()]);
      },
    });
  }
}
