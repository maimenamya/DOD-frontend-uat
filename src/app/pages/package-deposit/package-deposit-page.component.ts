import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import {
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { forkJoin } from 'rxjs';

import { AppModalComponent } from '../../components/app-modal/app-modal.component';
import {
  CustomDropdownComponent,
  type DropdownOption,
} from '../../components/custom-dropdown/custom-dropdown.component';
import { MasterListToolbarComponent } from '../../components/master-list-toolbar/master-list-toolbar.component';
import type { MstMembership, MstPromotion } from '../../models/master-data';
import type { PackageDepositRecord, PackageDepositSourceType } from '../../models/package-deposit';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { PackageDepositService } from '../../services/package-deposit.service';
import { ShopMasterService } from '../../services/shop-master.service';
import { ToastService } from '../../services/toast.service';
import { APP_MOBILE_MEDIA_QUERY, isAppMobileViewport } from '../../utils/app-viewport.util';
import {
  highlightInvalidForm,
  resetFormValidationFlag,
} from '../../utils/form-validation.util';
import {
  LOCAL_CODE_MAX_LENGTH,
  LOCAL_CODE_PATTERN,
  LOCAL_CODE_VALIDATORS_HINT,
  normalizeLocalCodeForSubmit,
  trimLocalCodeInput,
} from '../../utils/local-code.util';

type DepositSourceTab = PackageDepositSourceType;

function packageBottleTotal(items: Array<{ quantity: number }>): number {
  return items.reduce((sum, row) => sum + row.quantity, 0);
}

@Component({
  selector: 'app-package-deposit-page',
  imports: [
    NgTemplateOutlet,
    FormsModule,
    ReactiveFormsModule,
    AppModalComponent,
    CustomDropdownComponent,
    MasterListToolbarComponent,
  ],
  templateUrl: './package-deposit-page.component.html',
  styleUrl: './package-deposit-page.component.css',
})
export class PackageDepositPageComponent implements OnInit {
  private readonly packageDeposits = inject(PackageDepositService);
  private readonly shopMaster = inject(ShopMasterService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly items = signal<PackageDepositRecord[]>([]);
  readonly memberships = signal<MstMembership[]>([]);
  readonly promotions = signal<MstPromotion[]>([]);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly depositFormValidated = signal(false);
  readonly deleteFormValidated = signal(false);
  readonly createFormValidated = signal(false);
  readonly depositTarget = signal<PackageDepositRecord | null>(null);
  readonly deleteTarget = signal<PackageDepositRecord | null>(null);
  readonly createModalOpen = signal(false);
  readonly sourceTab = signal<DepositSourceTab>('MEMBERSHIP');
  readonly searchQuery = signal('');
  readonly expandedId = signal<number | null>(null);
  readonly mobileViewport = signal(isAppMobileViewport());

  readonly depositForm = this.fb.group({
    quantity: ['1', [Validators.required, Validators.pattern(/^[1-9]\d*$/)]],
    remainderNote: [''],
  });

  readonly deleteForm = this.fb.group({
    note: ['', [Validators.required, Validators.maxLength(500)]],
  });

  readonly createForm = this.fb.group({
    sourceId: [null as number | null, Validators.required],
    customerCode: [
      '',
      [Validators.required, Validators.maxLength(LOCAL_CODE_MAX_LENGTH), Validators.pattern(LOCAL_CODE_PATTERN)],
    ],
    customerName: [''],
    bottlesRemaining: ['', [Validators.required, Validators.pattern(/^[1-9]\d*$/)]],
    remainderNote: [''],
  });

  readonly createPackageOptions = computed((): DropdownOption[] => {
    const tab = this.sourceTab();
    const list =
      tab === 'MEMBERSHIP'
        ? this.memberships().filter((row) => row.allowDeposit)
        : this.promotions().filter((row) => row.allowDeposit);
    return list.map((row) => ({
      value: row.id,
      label: `${row.name} (${packageBottleTotal(row.items)} ขวด)`,
    }));
  });

  readonly selectedCreatePackage = computed(() => {
    const sourceId = this.createForm.controls.sourceId.value;
    if (sourceId == null) return null;
    const tab = this.sourceTab();
    if (tab === 'MEMBERSHIP') {
      return this.memberships().find((row) => row.id === sourceId) ?? null;
    }
    return this.promotions().find((row) => row.id === sourceId) ?? null;
  });

  readonly selectedCreatePackageBottlesTotal = computed(() => {
    const pkg = this.selectedCreatePackage();
    return pkg ? packageBottleTotal(pkg.items) : null;
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

  constructor() {
    if (typeof window !== 'undefined') {
      const mq = window.matchMedia(APP_MOBILE_MEDIA_QUERY);
      const onChange = (): void => this.mobileViewport.set(mq.matches);
      mq.addEventListener('change', onChange);
      this.destroyRef.onDestroy(() => mq.removeEventListener('change', onChange));
    }
  }

  ngOnInit(): void {
    this.loadPageData();
  }

  loadPageData(): void {
    this.loading.set(true);
    forkJoin({
      deposits: this.packageDeposits.list(),
      memberships: this.shopMaster.getMemberships(),
      promotions: this.shopMaster.getPromotions(),
    }).subscribe({
      next: ({ deposits, memberships, promotions }) => {
        this.items.set(deposits);
        this.memberships.set(memberships);
        this.promotions.set(promotions);
        this.loading.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถโหลดรายการฝากได้');
        this.loading.set(false);
      },
    });
  }

  loadItems(): void {
    this.packageDeposits.list().subscribe({
      next: (rows) => this.items.set(rows),
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถโหลดรายการฝากได้');
      },
    });
  }

  selectSourceTab(tab: DepositSourceTab): void {
    this.sourceTab.set(tab);
    this.expandedId.set(null);
    if (this.createModalOpen()) {
      this.createForm.controls.sourceId.setValue(null);
    }
  }

  openCreateModal(): void {
    this.createForm.reset({
      sourceId: null,
      customerCode: '',
      customerName: '',
      bottlesRemaining: '',
      remainderNote: '',
    });
    resetFormValidationFlag(this.createFormValidated);
    this.createModalOpen.set(true);
  }

  closeCreateModal(): void {
    this.createModalOpen.set(false);
    resetFormValidationFlag(this.createFormValidated);
  }

  onCreatePackageChange(value: number | string | null): void {
    const id = typeof value === 'number' ? value : value != null ? Number(value) : null;
    this.createForm.controls.sourceId.setValue(
      id != null && Number.isFinite(id) && id > 0 ? id : null,
    );
  }

  readonly localCodeHint = LOCAL_CODE_VALIDATORS_HINT;

  onCreateCustomerCodeInput(event: Event): void {
    const el = event.target as HTMLInputElement;
    const trimmed = trimLocalCodeInput(el.value);
    this.createForm.controls.customerCode.setValue(trimmed);
    if (el.value !== trimmed) {
      el.value = trimmed;
    }
  }

  submitCreate(): void {
    if (!this.createForm.controls.sourceId.value) {
      this.toast.showError('กรุณาเลือกแพ็กเกจ');
      resetFormValidationFlag(this.createFormValidated);
      this.createFormValidated.set(true);
      return;
    }
    if (highlightInvalidForm(this.createForm, this.createFormValidated, this.toast)) return;

    const pkg = this.selectedCreatePackage();
    const bottlesTotal = this.selectedCreatePackageBottlesTotal();
    if (!pkg || bottlesTotal == null) {
      this.toast.showError('กรุณาเลือกแพ็กเกจ');
      return;
    }

    const bottlesRemaining = Number(this.createForm.controls.bottlesRemaining.value);
    if (!Number.isFinite(bottlesRemaining) || bottlesRemaining < 1) {
      this.toast.showError('กรุณาระบุจำนวนขวดคงเหลืออย่างน้อย 1 ขวด');
      return;
    }
    if (bottlesRemaining > bottlesTotal) {
      this.toast.showError(`จำนวนคงเหลือต้องไม่เกิน ${bottlesTotal} ขวด (ขวดทั้งหมดของแพ็กเกจ)`);
      return;
    }

    const customerCode = normalizeLocalCodeForSubmit(this.createForm.controls.customerCode.value);
    if (!customerCode) {
      this.toast.showError('กรุณาระบุรหัสลูกค้า 1–10 ตัวอักษร (ตัวอักษร/ตัวเลข)');
      return;
    }
    const customerName = this.createForm.controls.customerName.value.trim();
    const remainderNote = this.createForm.controls.remainderNote.value.trim();

    this.submitting.set(true);
    this.packageDeposits
      .createOpeningBalance({
        sourceType: this.sourceTab(),
        sourceId: pkg.id,
        customerCode,
        customerName: customerName || undefined,
        bottlesRemaining,
        remainderNote: remainderNote || null,
      })
      .subscribe({
        next: (created) => {
          this.items.update((rows) => [created, ...rows]);
          this.toast.showSuccess('เพิ่มรายการฝากแล้ว');
          this.closeCreateModal();
          this.submitting.set(false);
        },
        error: (err: { error?: { error?: string } }) => {
          this.toast.showError(err.error?.error ?? 'ไม่สามารถเพิ่มรายการฝากได้');
          this.submitting.set(false);
        },
      });
  }

  onSearchChange(value: string): void {
    this.searchQuery.set(value);
    this.expandedId.set(null);
  }

  toggleExpanded(row: PackageDepositRecord): void {
    this.expandedId.update((current) => (current === row.id ? null : row.id));
  }

  closeExpanded(): void {
    this.expandedId.set(null);
  }

  tileAriaLabel(row: PackageDepositRecord): string {
    return `รหัส ${this.customerCodeDisplay(row)} ${this.customerNameDisplay(row)} — ${row.packageName} เหลือ ${row.bottlesLabel}`;
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
