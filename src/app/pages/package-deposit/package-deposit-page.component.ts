import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { AppModalComponent } from '../../components/app-modal/app-modal.component';
import { MasterListToolbarComponent } from '../../components/master-list-toolbar/master-list-toolbar.component';
import type { PackageDepositRecord, PackageDepositSourceType } from '../../models/package-deposit';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { PackageDepositService } from '../../services/package-deposit.service';
import { ToastService } from '../../services/toast.service';
import {
  highlightInvalidForm,
  resetFormValidationFlag,
} from '../../utils/form-validation.util';

type DepositSourceTab = PackageDepositSourceType;

@Component({
  selector: 'app-package-deposit-page',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    AppModalComponent,
    MasterListToolbarComponent,
  ],
  templateUrl: './package-deposit-page.component.html',
  styleUrl: './package-deposit-page.component.css',
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
  readonly sourceTab = signal<DepositSourceTab>('MEMBERSHIP');
  readonly searchQuery = signal('');

  readonly depositForm = this.fb.group({
    quantity: ['1', [Validators.required, Validators.pattern(/^[1-9]\d*$/)]],
    remainderNote: [''],
  });

  readonly visibleItems = computed(() => {
    const tab = this.sourceTab();
    const q = this.searchQuery().trim().toLowerCase();
    return this.items()
      .filter((row) => row.status === 'OPEN')
      .filter((row) => row.sourceType === tab)
      .filter((row) => {
        if (!q) return true;
        const haystack = [
          row.customerCode,
          row.customerName,
          row.displayLabel,
          row.packageName,
          row.openedOnLabel,
          row.bottlesLabel,
          row.remainderNote,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      });
  });

  readonly emptyText = computed(() =>
    this.sourceTab() === 'MEMBERSHIP' ? 'ยังไม่มีรายการฝากเมม' : 'ยังไม่มีรายการฝากโปร',
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

  selectSourceTab(tab: DepositSourceTab): void {
    this.sourceTab.set(tab);
  }

  onSearchChange(value: string): void {
    this.searchQuery.set(value);
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
      message: `ยืนยันปิดรายการฝาก ${this.rowHeadline(row)} — กินหมดแล้วไม่มีเหล้าเหลือ`,
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

  customerNameDisplay(row: PackageDepositRecord): string {
    const nickname = this.rowNickname(row);
    if (nickname) return nickname;
    const name = row.customerName?.trim();
    const code = row.customerCode?.trim();
    if (name && name !== code) return name;
    return '—';
  }

  customerCodeDisplay(row: PackageDepositRecord): string {
    return row.customerCode?.trim() || '—';
  }

  customerPrimaryLabel(row: PackageDepositRecord): string {
    const nickname = this.rowNickname(row);
    if (nickname) return nickname;
    const code = row.customerCode?.trim();
    if (code) return code;
    return row.customerName?.trim() || '—';
  }

  showCustomerCodeSubline(row: PackageDepositRecord): boolean {
    return !!this.rowNickname(row) && !!row.customerCode?.trim();
  }

  rowHeadline(row: PackageDepositRecord): string {
    return row.displayLabel || row.customerCode || row.customerName;
  }

  rowNickname(row: PackageDepositRecord): string | null {
    const code = row.customerCode?.trim();
    const name = row.customerName?.trim();
    if (!name || name === code) return null;
    return name;
  }
}
