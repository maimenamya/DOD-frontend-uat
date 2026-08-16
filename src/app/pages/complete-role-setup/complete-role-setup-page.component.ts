import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-complete-role-setup-page',
  templateUrl: './complete-role-setup-page.component.html',
})
export class CompleteRoleSetupPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly submitting = signal(false);

  ngOnInit(): void {
    if (!this.auth.needsRoleSetup()) {
      void this.router.navigateByUrl(this.auth.postLoginPathSegments()[0] ?? '/dashboard');
    }
  }

  confirm(): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.auth.completeRoleSetup().subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.showSuccess('ยืนยันตำแหน่งเรียบร้อย');
        const path = this.auth.postLoginPathSegments();
        if (path.length === 1 && path[0].startsWith('/')) {
          void this.router.navigateByUrl(path[0]);
        } else {
          void this.router.navigate(path);
        }
      },
      error: (err: { error?: { error?: string } }) => {
        this.submitting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถยืนยันตำแหน่งได้');
      },
    });
  }
}
