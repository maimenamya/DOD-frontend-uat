import { AfterViewInit, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
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

/** px tolerance when comparing scroll position to bottom */
const SCROLL_END_THRESHOLD_PX = 12;

@Component({
  selector: 'app-accept-privacy-page',
  imports: [FormsModule],
  templateUrl: './accept-privacy-page.component.html',
})
export class AcceptPrivacyPageComponent implements AfterViewInit {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  private readonly policyBody = viewChild<ElementRef<HTMLElement>>('policyBody');

  readonly policyTitle = PRIVACY_POLICY_TITLE;
  readonly policyVersion = PRIVACY_POLICY_VERSION;
  readonly sections = PRIVACY_POLICY_SECTIONS;
  readonly checkboxLabel = PRIVACY_CONSENT_CHECKBOX_LABEL;

  readonly agreed = signal(false);
  readonly submitting = signal(false);
  /** Unlocks checkbox after user scrolls policy text to the bottom (or content fits without scroll). */
  readonly scrolledToEnd = signal(false);

  constructor() {
    if (!this.auth.needsPrivacyConsent()) {
      void this.router.navigate([this.auth.homePathAfterLogin()]);
    }
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => this.syncScrollGate());
  }

  onPolicyScroll(): void {
    this.syncScrollGate();
  }

  submit(): void {
    if (!this.scrolledToEnd()) {
      return;
    }
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

  private syncScrollGate(): void {
    const el = this.policyBody()?.nativeElement;
    if (!el) {
      return;
    }
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (remaining <= SCROLL_END_THRESHOLD_PX) {
      this.scrolledToEnd.set(true);
    }
  }
}
