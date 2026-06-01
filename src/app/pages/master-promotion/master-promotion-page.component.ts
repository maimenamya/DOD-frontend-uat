import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
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
import type { MstPromotion } from '../../models/master-data';
import { AuthService } from '../../services/auth.service';
import { BeverageService } from '../../services/beverage.service';
import { ShopMasterService } from '../../services/shop-master.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-master-promotion-page',
  imports: [DecimalPipe, ReactiveFormsModule, AppModalComponent, CustomDropdownComponent],
  templateUrl: './master-promotion-page.component.html',
})
export class MasterPromotionPageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly shopMaster = inject(ShopMasterService);
  private readonly beverageService = inject(BeverageService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly canManage = computed(() => this.auth.canAccessTeamManagement());
  readonly promotions = signal<MstPromotion[]>([]);
  readonly drinkOptions = signal<DropdownOption[]>([]);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly editingItem = signal<MstPromotion | null>(null);
  readonly showCreateModal = signal(false);

  readonly createForm = this.fb.group({
    name: ['', Validators.required],
    packagePrice: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    drinkId: [0, [Validators.required, Validators.min(1)]],
    quantity: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    isFreeMixer: [false],
  });

  readonly editForm = this.fb.group({
    name: ['', Validators.required],
    packagePrice: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    drinkId: [0, [Validators.required, Validators.min(1)]],
    quantity: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    isFreeMixer: [false],
  });

  ngOnInit(): void {
    this.loadItems();
  }

  loadItems(): void {
    this.loading.set(true);
    this.showCreateModal.set(false);
    forkJoin({
      promotions: this.shopMaster.getPromotions(),
      beverages: this.beverageService.getBeverages(),
    }).subscribe({
      next: ({ promotions, beverages }) => {
        this.promotions.set(promotions);
        this.drinkOptions.set(
          beverages.map((b) => ({ value: b.id, label: b.name })),
        );
        this.loading.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถโหลดข้อมูลโปรโมชั่นได้');
        this.loading.set(false);
      },
    });
  }

  drinkName(item: MstPromotion): string {
    return item.drink?.name ?? '—';
  }

  freeMixerLabel(value: boolean): string {
    return value ? 'ใช่' : 'ไม่';
  }

  openCreate(): void {
    if (this.loading()) return;
    this.createForm.reset({
      name: '',
      packagePrice: '',
      drinkId: 0,
      quantity: '',
      isFreeMixer: false,
    });
    this.showCreateModal.set(true);
  }

  closeCreate(): void {
    this.showCreateModal.set(false);
  }

  openEdit(item: MstPromotion): void {
    this.editForm.reset({
      name: item.name,
      packagePrice: String(item.packagePrice),
      drinkId: item.drinkId,
      quantity: String(item.quantity),
      isFreeMixer: item.isFreeMixer,
    });
    this.editingItem.set(item);
  }

  closeEdit(): void {
    this.editingItem.set(null);
  }

  submitCreate(): void {
    if (this.createForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    const raw = this.createForm.getRawValue();
    const payload = {
      ...raw,
      packagePrice: Number.parseInt(raw.packagePrice, 10),
      quantity: Number.parseInt(raw.quantity, 10),
    };
    this.shopMaster.createPromotion(payload).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeCreate();
        this.toast.showSuccess('เพิ่มโปรโมชั่นเรียบร้อย');
        this.loadItems();
      },
      error: (err: { error?: { error?: string } }) => {
        this.submitting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถเพิ่มโปรโมชั่นได้');
      },
    });
  }

  submitEdit(): void {
    const item = this.editingItem();
    if (!item || this.editForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    const raw = this.editForm.getRawValue();
    const payload = {
      ...raw,
      packagePrice: Number.parseInt(raw.packagePrice, 10),
      quantity: Number.parseInt(raw.quantity, 10),
    };
    this.shopMaster.updatePromotion(item.id, payload).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeEdit();
        this.toast.showSuccess('บันทึกการแก้ไขเรียบร้อย');
        this.loadItems();
      },
      error: (err: { error?: { error?: string } }) => {
        this.submitting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถแก้ไขโปรโมชั่นได้');
      },
    });
  }

  async confirmDelete(item: MstPromotion): Promise<void> {
    const ok = await this.confirmDialog.confirmDelete(`โปรโมชั่น "${item.name}"`);
    if (!ok) return;
    this.shopMaster.deletePromotion(item.id).subscribe({
      next: () => {
        this.toast.showSuccess('ลบโปรโมชั่นเรียบร้อย');
        this.loadItems();
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถลบโปรโมชั่นได้');
      },
    });
  }

  sanitizeIntegerInput(
    form: 'create' | 'edit',
    controlName: 'packagePrice' | 'quantity',
    event: Event,
  ): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/\D+/g, '');
    const targetForm = form === 'create' ? this.createForm : this.editForm;
    targetForm.controls[controlName].setValue(sanitized, { emitEvent: false });
  }
}
