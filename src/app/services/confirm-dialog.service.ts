import { Injectable, computed, signal } from '@angular/core';

export const CHANGE_REASON_MIN_LEN = 3;

export type ConfirmDialogOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

type PendingBooleanConfirm = {
  kind: 'boolean';
  options: Required<Pick<ConfirmDialogOptions, 'message'>> &
    Omit<ConfirmDialogOptions, 'message'>;
  resolve: (confirmed: boolean) => void;
};

type PendingReasonConfirm = {
  kind: 'reason';
  options: Required<Pick<ConfirmDialogOptions, 'message'>> &
    Omit<ConfirmDialogOptions, 'message'> & {
      reasonLabel: string;
      reasonPlaceholder: string;
    };
  resolve: (reason: string | null) => void;
};

type PendingConfirm = PendingBooleanConfirm | PendingReasonConfirm;

/** Global confirm dialog — same UI as open-table checkout (`app-confirm-dialog`). */
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly pending = signal<PendingConfirm | null>(null);
  readonly busy = signal(false);
  readonly reasonText = signal('');
  readonly reasonValidated = signal(false);

  readonly open = computed(() => this.pending() !== null);
  readonly requiresReason = computed(() => this.pending()?.kind === 'reason');

  readonly title = computed(() => this.pending()?.options.title ?? 'ยืนยัน');
  readonly message = computed(() => this.pending()?.options.message ?? '');
  readonly confirmLabel = computed(() => this.pending()?.options.confirmLabel ?? 'ยืนยัน');
  readonly cancelLabel = computed(() => this.pending()?.options.cancelLabel ?? 'ยกเลิก');
  readonly reasonLabel = computed(() => {
    const current = this.pending();
    if (current?.kind === 'reason') return current.options.reasonLabel;
    return 'เหตุผลการแก้ไข/ลบ';
  });
  readonly reasonPlaceholder = computed(() => {
    const current = this.pending();
    if (current?.kind === 'reason') return current.options.reasonPlaceholder;
    return 'ระบุเหตุผลอย่างน้อย 3 ตัวอักษร';
  });

  confirm(options: ConfirmDialogOptions): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.pending()) {
        resolve(false);
        return;
      }
      this.resetReasonState();
      this.busy.set(false);
      this.pending.set({
        kind: 'boolean',
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

  confirmWithReason(
    options: ConfirmDialogOptions & { reasonLabel?: string; reasonPlaceholder?: string },
  ): Promise<string | null> {
    return new Promise((resolve) => {
      if (this.pending()) {
        resolve(null);
        return;
      }
      this.resetReasonState();
      this.busy.set(false);
      this.pending.set({
        kind: 'reason',
        options: {
          title: options.title ?? 'ยืนยัน',
          message: options.message,
          confirmLabel: options.confirmLabel ?? 'ยืนยัน',
          cancelLabel: options.cancelLabel ?? 'ยกเลิก',
          reasonLabel: options.reasonLabel ?? 'เหตุผลการแก้ไข/ลบ',
          reasonPlaceholder: options.reasonPlaceholder ?? 'ระบุเหตุผลอย่างน้อย 3 ตัวอักษร',
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

  /** Delete with required audit reason (money-impacting masters). */
  confirmDeleteWithReason(itemLabel: string): Promise<string | null> {
    return this.confirmWithReason({
      title: 'ยืนยันการลบ',
      message: `ลบ${itemLabel} ใช่หรือไม่?`,
      confirmLabel: 'ลบ',
    });
  }

  onReasonTextChange(value: string): void {
    this.reasonText.set(value);
    if (this.reasonValidated() && value.trim().length >= CHANGE_REASON_MIN_LEN) {
      this.reasonValidated.set(false);
    }
  }

  onConfirm(): void {
    const current = this.pending();
    if (!current) return;
    if (current.kind === 'reason') {
      const trimmed = this.reasonText().trim();
      if (trimmed.length < CHANGE_REASON_MIN_LEN) {
        this.reasonValidated.set(true);
        return;
      }
      current.resolve(trimmed);
      this.clearPending();
      return;
    }
    current.resolve(true);
    this.clearPending();
  }

  onCancel(): void {
    const current = this.pending();
    if (!current) return;
    if (current.kind === 'reason') {
      current.resolve(null);
    } else {
      current.resolve(false);
    }
    this.clearPending();
  }

  onDismiss(): void {
    this.onCancel();
  }

  private resetReasonState(): void {
    this.reasonText.set('');
    this.reasonValidated.set(false);
  }

  private clearPending(): void {
    this.pending.set(null);
    this.busy.set(false);
    this.resetReasonState();
  }
}
