import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import {
  PRIVACY_CONSENT_CHECKBOX_LABEL,
  PRIVACY_POLICY_SECTIONS,
  PRIVACY_POLICY_TITLE,
  PRIVACY_POLICY_VERSION,
} from '../../constants/privacy-policy.constant';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-accept-privacy-page',
  imports: [FormsModule],
  templateUrl: './accept-privacy-page.component.html',
})
export class AcceptPrivacyPageComponent {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly policyTitle = PRIVACY_POLICY_TITLE;
  readonly policyVersion = PRIVACY_POLICY_VERSION;
  readonly sections = PRIVACY_POLICY_SECTIONS;
  readonly checkboxLabel = PRIVACY_CONSENT_CHECKBOX_LABEL;

  readonly agreed = signal(false);
  readonly submitting = signal(false);

  constructor() {
    if (!this.auth.needsPrivacyConsent()) {
      void this.router.navigate([this.auth.homePathAfterLogin()]);
    }
  }

  submit(): void {
    if (!this.agreed()) {
      this.toast.showError('กรุณาติ๊กยอมรับนโยบายก่อนดำเนินการต่อ');
      return;
    }

    this.submitting.set(true);
    this.auth.acceptPrivacyPolicy(PRIVACY_POLICY_VERSION).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.showSuccess('บันทึกความยินยอมเรียบร้อย');
        void this.router.navigate([this.auth.homePathAfterLogin()]);
      },
      error: (err: { error?: { error?: string } }) => {
        this.submitting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถบันทึกความยินยอมได้');
      },
    });
  }
}
