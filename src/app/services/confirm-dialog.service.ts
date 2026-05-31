import { Injectable, computed, signal } from '@angular/core';

export type ConfirmDialogOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

type PendingConfirm = {
  options: Required<Pick<ConfirmDialogOptions, 'message'>> &
    Omit<ConfirmDialogOptions, 'message'>;
  resolve: (confirmed: boolean) => void;
};

/** Global confirm dialog — same UI as open-table checkout (`app-confirm-dialog`). */
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly pending = signal<PendingConfirm | null>(null);
  readonly busy = signal(false);

  readonly open = computed(() => this.pending() !== null);

  readonly title = computed(() => this.pending()?.options.title ?? 'ยืนยัน');
  readonly message = computed(() => this.pending()?.options.message ?? '');
  readonly confirmLabel = computed(() => this.pending()?.options.confirmLabel ?? 'ยืนยัน');
  readonly cancelLabel = computed(() => this.pending()?.options.cancelLabel ?? 'ยกเลิก');

  confirm(options: ConfirmDialogOptions): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.pending()) {
        resolve(false);
        return;
      }
      this.busy.set(false);
      this.pending.set({
        options: {
          title: options.title ?? 'ยืนยัน',
          message: options.message,
          confirmLabel: options.confirmLabel ?? 'ยืนยัน',
          cancelLabel: options.cancelLabel ?? 'ยกเลิก',
        },
        resolve,
      });
    });
  }

  /** Shorthand for delete actions across master pages. */
  confirmDelete(itemLabel: string): Promise<boolean> {
    return this.confirm({
      title: 'ยืนยันการลบ',
      message: `ลบ${itemLabel} ใช่หรือไม่?`,
      confirmLabel: 'ลบ',
    });
  }

  onConfirm(): void {
    const current = this.pending();
    if (!current) return;
    current.resolve(true);
    this.pending.set(null);
    this.busy.set(false);
  }

  onCancel(): void {
    const current = this.pending();
    if (!current) return;
    current.resolve(false);
    this.pending.set(null);
    this.busy.set(false);
  }

  onDismiss(): void {
    this.onCancel();
  }
}
