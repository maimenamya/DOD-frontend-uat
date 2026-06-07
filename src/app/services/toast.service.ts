import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error';

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  static readonly AUTO_DISMISS_MS = 3000;

  readonly message = signal<string | null>(null);
  readonly kind = signal<ToastKind>('success');
  /** Bumps on each show so progress bar animation restarts. */
  readonly toastKey = signal(0);

  showSuccess(message: string): void {
    this.show(message, 'success');
  }

  showError(message: string): void {
    this.show(message, 'error');
  }

  dismiss(): void {
    this.message.set(null);
  }

  private show(message: string, kind: ToastKind): void {
    this.kind.set(kind);
    this.message.set(message);
    this.toastKey.update((k) => k + 1);
  }
}
