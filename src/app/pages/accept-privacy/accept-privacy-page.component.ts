import {
  Component,
  ElementRef,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
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

/** Pixels from bottom that still count as “read to end” (mobile scrollbar slack). */
const DOC_SCROLL_END_SLACK_PX = 32;

@Component({
  selector: 'app-accept-privacy-page',
  imports: [FormsModule],
  templateUrl: './accept-privacy-page.component.html',
})
export class AcceptPrivacyPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  private readonly docScroll = viewChild<ElementRef<HTMLElement>>('docScroll');

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
  /** Checkbox unlocked only after scrolling the document to the bottom. */
  readonly docReadToEnd = signal(false);

  ngOnInit(): void {
    if (!this.auth.needsPrivacyConsent()) {
      void this.router.navigate([this.auth.homePathAfterLogin()]);
      return;
    }
    this.resetDocScrollGate();
  }

  onDocScroll(): void {
    const el = this.docScroll()?.nativeElement;
    if (!el || this.docReadToEnd()) return;
    if (this.isScrolledToEnd(el)) {
      this.docReadToEnd.set(true);
    }
  }

  setTermsAgreed(value: boolean): void {
    if (!this.docReadToEnd()) return;
    this.termsAgreed.set(value);
  }

  setPrivacyAgreed(value: boolean): void {
    if (!this.docReadToEnd()) return;
    this.privacyAgreed.set(value);
  }

  setPartnerShare(value: boolean): void {
    if (!this.docReadToEnd()) return;
    this.partnerShare.set(value);
  }

  goNext(): void {
    if (!this.termsAgreed()) {
      this.consentValidated.set(true);
      return;
    }
    this.consentValidated.set(false);
    this.step.set(2);
    this.resetDocScrollGate();
  }

  goBack(): void {
    this.consentValidated.set(false);
    this.step.set(1);
    this.resetDocScrollGate();
  }

  submit(): void {
    if (!this.termsAgreed() || !this.privacyAgreed()) {
      this.consentValidated.set(true);
      if (!this.termsAgreed()) {
        this.step.set(1);
        this.resetDocScrollGate();
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

  private resetDocScrollGate(): void {
    const alreadyAgreedForStep =
      (this.step() === 1 && this.termsAgreed()) ||
      (this.step() === 2 && this.privacyAgreed());
    this.docReadToEnd.set(alreadyAgreedForStep);
    queueMicrotask(() => {
      const el = this.docScroll()?.nativeElement;
      if (!el) return;
      el.scrollTo({ top: 0 });
      window.scrollTo({ top: 0 });
      if (this.docReadToEnd()) return;
      // Short content (no overflow) counts as already readable.
      if (el.scrollHeight <= el.clientHeight + 4 || this.isScrolledToEnd(el)) {
        this.docReadToEnd.set(true);
      }
    });
  }

  private isScrolledToEnd(el: HTMLElement): boolean {
    return el.scrollTop + el.clientHeight >= el.scrollHeight - DOC_SCROLL_END_SLACK_PX;
  }
}
