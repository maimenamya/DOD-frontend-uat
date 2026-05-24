import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error';

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  readonly message = signal<string | null>(null);
  readonly kind = signal<ToastKind>('success');

  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  private static readonly AUTO_DISMISS_MS = 5000;

  showSuccess(message: string): void {
    this.show(message, 'success');
  }

  showError(message: string): void {
    this.show(message, 'error');
  }

  dismiss(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    this.message.set(null);
  }

  private show(message: string, kind: ToastKind): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
    }
    this.kind.set(kind);
    this.message.set(message);
    this.hideTimer = setTimeout(() => {
      this.message.set(null);
      this.hideTimer = null;
    }, ToastService.AUTO_DISMISS_MS);
  }
}
