import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import {
  PRIVACY_CONSENT_CHECKBOX_LABEL,
  PRIVACY_PARTNER_SHARE_CHECKBOX_LABEL,
  PRIVACY_POLICY_SECTIONS,
  PRIVACY_POLICY_TITLE,
  PRIVACY_POLICY_VERSION,
  TERMS_CONSENT_CHECKBOX_LABEL,
  TERMS_OF_SERVICE_SECTIONS,
  TERMS_OF_SERVICE_TITLE,
} from '../../constants/privacy-policy.constant';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

type ConsentStep = 1 | 2;

@Component({
  selector: 'app-accept-privacy-page',
  imports: [FormsModule],
  templateUrl: './accept-privacy-page.component.html',
})
export class AcceptPrivacyPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly policyVersion = PRIVACY_POLICY_VERSION;
  readonly termsTitle = TERMS_OF_SERVICE_TITLE;
  readonly termsSections = TERMS_OF_SERVICE_SECTIONS;
  readonly termsCheckboxLabel = TERMS_CONSENT_CHECKBOX_LABEL;
  readonly privacyTitle = PRIVACY_POLICY_TITLE;
  readonly privacySections = PRIVACY_POLICY_SECTIONS;
  readonly privacyCheckboxLabel = PRIVACY_CONSENT_CHECKBOX_LABEL;
  readonly partnerShareLabel = PRIVACY_PARTNER_SHARE_CHECKBOX_LABEL;

  readonly step = signal<ConsentStep>(1);
  readonly termsAgreed = signal(false);
  readonly privacyAgreed = signal(false);
  readonly partnerShare = signal(this.auth.allowBusinessDataPartnerShare());
  readonly submitting = signal(false);
  readonly consentValidated = signal(false);

  ngOnInit(): void {
    if (!this.auth.needsPrivacyConsent()) {
      void this.router.navigate([this.auth.homePathAfterLogin()]);
    }
  }

  goNext(): void {
    if (!this.termsAgreed()) {
      this.consentValidated.set(true);
      return;
    }
    this.consentValidated.set(false);
    this.step.set(2);
    this.scrollDocToTop();
  }

  goBack(): void {
    this.consentValidated.set(false);
    this.step.set(1);
    this.scrollDocToTop();
  }

  submit(): void {
    if (!this.termsAgreed() || !this.privacyAgreed()) {
      this.consentValidated.set(true);
      if (!this.termsAgreed()) {
        this.step.set(1);
        this.scrollDocToTop();
      }
      return;
    }

    this.submitting.set(true);
    this.auth.acceptPrivacyPolicy(PRIVACY_POLICY_VERSION, this.partnerShare()).subscribe({
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

  private scrollDocToTop(): void {
    queueMicrotask(() => {
      const el = document.querySelector('.accept-privacy-card__body');
      el?.scrollTo({ top: 0, behavior: 'smooth' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}
