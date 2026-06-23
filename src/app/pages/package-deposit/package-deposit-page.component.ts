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
  readonly deleteFormValidated = signal(false);
  readonly depositTarget = signal<PackageDepositRecord | null>(null);
  readonly deleteTarget = signal<PackageDepositRecord | null>(null);
  readonly sourceTab = signal<DepositSourceTab>('MEMBERSHIP');
  readonly searchQuery = signal('');
  readonly expandedId = signal<number | null>(null);

  readonly depositForm = this.fb.group({
    quantity: ['1', [Validators.required, Validators.pattern(/^[1-9]\d*$/)]],
    remainderNote: [''],
  });

  readonly deleteForm = this.fb.group({
    note: ['', [Validators.required, Validators.maxLength(500)]],
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

  readonly expandedRow = computed(() => {
    const id = this.expandedId();
    if (id == null) return null;
    return this.visibleItems().find((row) => row.id === id) ?? null;
  });

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
    this.expandedId.set(null);
  }

  onSearchChange(value: string): void {
    this.searchQuery.set(value);
    this.expandedId.set(null);
  }

  toggleExpanded(row: PackageDepositRecord): void {
    this.expandedId.update((current) => (current === row.id ? null : row.id));
  }

  tileAriaLabel(row: PackageDepositRecord): string {
    return `${this.customerNameDisplay(row)} รหัส ${this.customerCodeDisplay(row)} — ${row.packageName} เหลือ ${row.bottlesLabel}`;
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

  openDelete(row: PackageDepositRecord): void {
    if (!row.canDelete) return;
    this.deleteTarget.set(row);
    this.deleteForm.reset({ note: '' });
    resetFormValidationFlag(this.deleteFormValidated);
  }

  closeDeleteModal(): void {
    this.deleteTarget.set(null);
    resetFormValidationFlag(this.deleteFormValidated);
  }

  submitDelete(): void {
    const target = this.deleteTarget();
    if (!target) return;

    if (highlightInvalidForm(this.deleteForm, this.deleteFormValidated, this.toast)) return;

    const note = this.deleteForm.controls.note.value.trim();
    this.submitting.set(true);
    this.packageDeposits.cancel(target.id, { note }).subscribe({
      next: (updated) => {
        this.items.update((rows) => rows.map((row) => (row.id === updated.id ? updated : row)));
        this.toast.showSuccess('ลบรายการฝากแล้ว');
        this.expandedId.set(null);
        this.closeDeleteModal();
        this.submitting.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถลบรายการฝากได้');
        this.submitting.set(false);
      },
    });
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
      message: `ยืนยันปิดรายการฝาก ${this.rowHeadline(row)} — กินหมดแล้ว ไม่มีขวดเหลือ`,
      confirmLabel: 'ปิดรายการ',
    });
    if (!ok) return;

    this.packageDeposits.close(row.id).subscribe({
      next: (updated) => {
        this.items.update((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
        this.toast.showSuccess('ปิดรายการฝากแล้ว');
        this.expandedId.set(null);
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
