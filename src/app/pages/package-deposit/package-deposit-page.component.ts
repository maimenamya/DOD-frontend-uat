import { NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { AppModalComponent } from '../../components/app-modal/app-modal.component';
import type { PackageDepositRecord } from '../../models/package-deposit';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { PackageDepositService } from '../../services/package-deposit.service';
import { ToastService } from '../../services/toast.service';
import {
  highlightInvalidForm,
  resetFormValidationFlag,
} from '../../utils/form-validation.util';

@Component({
  selector: 'app-package-deposit-page',
  imports: [NgTemplateOutlet, FormsModule, ReactiveFormsModule, AppModalComponent],
  templateUrl: './package-deposit-page.component.html',
})
export class PackageDepositPageComponent implements OnInit {
  private readonly packageDeposits = inject(PackageDepositService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly items = signal<PackageDepositRecord[]>([]);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly depositFormValidated = signal(false);
  readonly depositTarget = signal<PackageDepositRecord | null>(null);

  readonly depositForm = this.fb.group({
    quantity: ['1', [Validators.required, Validators.pattern(/^[1-9]\d*$/)]],
    remainderNote: [''],
  });

  readonly membershipItems = computed(() =>
    this.items().filter((row) => row.sourceType === 'MEMBERSHIP'),
  );

  readonly promotionItems = computed(() =>
    this.items().filter((row) => row.sourceType === 'PROMOTION'),
  );

  ngOnInit(): void {
    this.loadItems();
  }

  loadItems(): void {
    this.loading.set(true);
    this.packageDeposits.list().subscribe({
      next: (rows) => {
        this.items.set(rows);
        this.loading.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถโหลดรายการฝากได้');
        this.loading.set(false);
      },
    });
  }

  openDeposit(row: PackageDepositRecord): void {
    if (!row.canDeposit) return;
    this.depositTarget.set(row);
    this.depositForm.reset({
      quantity: '1',
      remainderNote: '',
    });
    resetFormValidationFlag(this.depositFormValidated);
  }

  closeDepositModal(): void {
    this.depositTarget.set(null);
    resetFormValidationFlag(this.depositFormValidated);
  }

  submitDeposit(): void {
    const target = this.depositTarget();
    if (!target) return;

    if (this.depositForm.invalid) {
      highlightInvalidForm(this.depositForm, this.depositFormValidated);
      return;
    }

    const quantity = Number(this.depositForm.controls.quantity.value);
    const remainderNote = this.depositForm.controls.remainderNote.value.trim();

    this.submitting.set(true);
    this.packageDeposits
      .deposit(target.id, {
        quantity,
        remainderNote: remainderNote || null,
      })
      .subscribe({
        next: (updated) => {
          this.items.update((rows) => rows.map((row) => (row.id === updated.id ? updated : row)));
          this.toast.showSuccess('บันทึกการฝากแล้ว');
          this.closeDepositModal();
          this.submitting.set(false);
        },
        error: (err: { error?: { error?: string } }) => {
          this.toast.showError(err.error?.error ?? 'ไม่สามารถบันทึกการฝากได้');
          this.submitting.set(false);
        },
      });
  }

  async confirmClose(row: PackageDepositRecord): Promise<void> {
    if (!row.canClose) return;
    const ok = await this.confirmDialog.confirm({
      title: 'ปิดรายการฝาก',
      message: `ยืนยันปิดรายการฝากของ ${row.customerName} (${row.packageName}) — กินหมดแล้วไม่มีเหล้าเหลือ`,
      confirmLabel: 'ปิดรายการ',
    });
    if (!ok) return;

    this.packageDeposits.close(row.id).subscribe({
      next: (updated) => {
        this.items.update((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
        this.toast.showSuccess('ปิดรายการฝากแล้ว');
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถปิดรายการฝากได้');
      },
    });
  }

  statusLabel(row: PackageDepositRecord): string {
    return row.status === 'OPEN' ? 'เปิดอยู่' : 'ปิดแล้ว';
  }
}
