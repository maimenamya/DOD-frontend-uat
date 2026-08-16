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
import { combineLatest, map } from 'rxjs';

import { shopLoginQueryParams } from '../../core/login-url.util';
import { readStoredShopPublicId, writeStoredShopPublicId } from '../../core/shop-public-id.storage';
import { AuthService } from '../../services/auth.service';
import {
  LOCAL_CODE_MAX_LENGTH,
  LOCAL_CODE_PATTERN,
} from '../../utils/local-code.util';
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

  /** Route `/s/:shopPublicId/login` or canonical `/login?shop=`. */
  private readonly shopPublicIdParam = toSignal(
    combineLatest([this.route.paramMap, this.route.queryParamMap]).pipe(
      map(
        ([params, query]) =>
          (params.get('shopPublicId') ?? query.get('shop') ?? '').trim(),
      ),
    ),
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
    employeeId: [
      '',
      [
        Validators.required,
        Validators.minLength(1),
        Validators.maxLength(LOCAL_CODE_MAX_LENGTH),
        Validators.pattern(LOCAL_CODE_PATTERN),
      ],
    ],
    password: ['', [Validators.required]],
  });

  ngOnInit(): void {
    const fromRoute = this.route.snapshot.paramMap.get('shopPublicId')?.trim() ?? '';
    if (fromRoute) {
      // Canonical URL under `/` so Add to Home Screen keeps iOS scope = whole site.
      const homescreen = this.route.snapshot.queryParamMap.get('homescreen');
      void this.router.navigate(['/login'], {
        queryParams: shopLoginQueryParams(fromRoute, { homescreen }),
        replaceUrl: true,
      });
      return;
    }

    // Prefer snapshot over toSignal — initialValue '' can race and show "missing link"
    // even when ?shop= is already on the URL (common after Home Screen launch).
    const publicId =
      this.route.snapshot.queryParamMap.get('shop')?.trim() ||
      this.shopPublicIdParam() ||
      '';
    if (!publicId) {
      const last = readStoredShopPublicId();
      if (last) {
        void this.router.navigate(['/login'], {
          queryParams: shopLoginQueryParams(last, {
            homescreen: this.route.snapshot.queryParamMap.get('homescreen'),
          }),
          replaceUrl: true,
        });
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
    if (this.auth.needsRoleSetup()) {
      this.loading.set(false);
      void this.router.navigateByUrl('/dashboard/complete-role-setup');
      return;
    }

    this.auth.fetchAccessibleBranches().subscribe({
      next: () => {
        this.loading.set(false);
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl')?.trim();
        if (
          returnUrl &&
          returnUrl.startsWith('/') &&
          !this.auth.needsRoleSetup() &&
          !this.auth.needsPasswordChange() &&
          !this.auth.needsPrivacyConsent()
        ) {
          void this.router.navigateByUrl(returnUrl);
          return;
        }
        const path = this.auth.postLoginPathSegments();
        if (path.length === 1 && path[0].startsWith('/')) {
          void this.router.navigateByUrl(path[0]);
        } else {
          void this.router.navigate(path);
        }
      },
      error: () => {
        this.loading.set(false);
        const path = this.auth.postLoginPathSegments();
        if (path.length === 1 && path[0].startsWith('/')) {
          void this.router.navigateByUrl(path[0]);
        } else {
          void this.router.navigate(path);
        }
      },
    });
  }
}
