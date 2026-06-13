import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  highlightInvalidForm,
  resetFormValidationFlag,
} from '../../utils/form-validation.util';
import { DecimalPipe } from '@angular/common';
import {
  NonNullableFormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { forkJoin } from 'rxjs';

import { AppModalComponent } from '../../components/app-modal/app-modal.component';
import {
  CustomDropdownComponent,
  type DropdownOption,
} from '../../components/custom-dropdown/custom-dropdown.component';
import type { MstBeverage, MstBeverageCategory } from '../../models/beverage';
import type { MstPromotion } from '../../models/master-data';
import { AuthService } from '../../services/auth.service';
import { BeverageService } from '../../services/beverage.service';
import { ShopMasterService } from '../../services/shop-master.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-master-promotion-page',
  imports: [DecimalPipe, FormsModule, ReactiveFormsModule, AppModalComponent, CustomDropdownComponent],
  templateUrl: './master-promotion-page.component.html',
})
export class MasterPromotionPageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly shopMaster = inject(ShopMasterService);
  private readonly beverageService = inject(BeverageService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly canManage = computed(() => this.auth.canWriteOnPage('master_data'));
  readonly promotions = signal<MstPromotion[]>([]);
  readonly beverages = signal<MstBeverage[]>([]);
  readonly beverageCategories = signal<MstBeverageCategory[]>([]);
  readonly createDrinkCategoryId = signal<number | null>(null);
  readonly editDrinkCategoryId = signal<number | null>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly createFormValidated = signal(false);
  readonly editFormValidated = signal(false);
  readonly editingItem = signal<MstPromotion | null>(null);
  readonly showCreateModal = signal(false);

  readonly beverageCategoryOptions = computed<DropdownOption[]>(() =>
    this.beverageCategories().map((c) => ({ value: c.id, label: c.name })),
  );

  readonly createDrinkOptions = computed<DropdownOption[]>(() =>
    this.drinkOptionsForCategory(this.createDrinkCategoryId()),
  );

  readonly editDrinkOptions = computed<DropdownOption[]>(() =>
    this.drinkOptionsForCategory(this.editDrinkCategoryId()),
  );

  readonly createForm = this.fb.group({
    name: ['', Validators.required],
    packagePrice: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    drinkId: [0, [Validators.required, Validators.min(1)]],
    quantity: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    isFreeMixer: [false],
    allowDeposit: [false],
    freeDrinks: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
  });

  readonly editForm = this.fb.group({
    name: ['', Validators.required],
    packagePrice: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    drinkId: [0, [Validators.required, Validators.min(1)]],
    quantity: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    isFreeMixer: [false],
    allowDeposit: [false],
    freeDrinks: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
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
      beverageCategories: this.shopMaster.getBeverageCategories(),
    }).subscribe({
      next: ({ promotions, beverages, beverageCategories }) => {
        this.promotions.set(promotions);
        this.beverages.set(beverages);
        this.beverageCategories.set(beverageCategories);
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

  allowDepositLabel(value: boolean): string {
    return value ? 'ได้' : 'ไม่ได้';
  }

  onCreateDrinkCategoryChange(value: number | string | null): void {
    const id = value == null || value === '' ? null : Number(value);
    if (id == null || !Number.isFinite(id)) return;
    this.createDrinkCategoryId.set(id);
    this.syncCreateDrinkId();
  }

  onEditDrinkCategoryChange(value: number | string | null): void {
    const id = value == null || value === '' ? null : Number(value);
    if (id == null || !Number.isFinite(id)) return;
    this.editDrinkCategoryId.set(id);
    this.syncEditDrinkId();
  }

  openCreate(): void {
    
    resetFormValidationFlag(this.createFormValidated);
    if (this.loading()) return;
    const firstCategoryId = this.beverageCategories()[0]?.id ?? null;
    this.createDrinkCategoryId.set(firstCategoryId);
    this.createForm.reset({
      name: '',
      packagePrice: '',
      drinkId: 0,
      quantity: '',
      isFreeMixer: false,
      allowDeposit: false,
      freeDrinks: '',
    });
    this.syncCreateDrinkId();
    this.showCreateModal.set(true);
  }

  closeCreate(): void {
    this.showCreateModal.set(false);
  }

  openEdit(item: MstPromotion): void {
    
    resetFormValidationFlag(this.editFormValidated);
const beverage = this.beverages().find((b) => b.id === item.drinkId);
    this.editDrinkCategoryId.set(beverage?.categoryId ?? this.beverageCategories()[0]?.id ?? null);
    this.editForm.reset({
      name: item.name,
      packagePrice: String(item.packagePrice),
      drinkId: item.drinkId,
      quantity: String(item.quantity),
      isFreeMixer: item.isFreeMixer,
      allowDeposit: item.allowDeposit ?? false,
      freeDrinks: String(item.freeDrinks ?? 0),
    });
    this.editingItem.set(item);
  }

  closeEdit(): void {
    this.editingItem.set(null);
  }

  submitCreate(): void {
    if (this.submitting()) return;
    if (highlightInvalidForm(this.createForm, this.createFormValidated, this.toast)) return;
    this.submitting.set(true);
    const raw = this.createForm.getRawValue();
    const payload = {
      ...raw,
      packagePrice: Number.parseInt(raw.packagePrice, 10),
      quantity: Number.parseInt(raw.quantity, 10),
      freeDrinks: Number.parseInt(raw.freeDrinks, 10),
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
    if (!item || this.submitting()) return;
    if (highlightInvalidForm(this.editForm, this.editFormValidated, this.toast)) return;
    this.submitting.set(true);
    const raw = this.editForm.getRawValue();
    const payload = {
      ...raw,
      packagePrice: Number.parseInt(raw.packagePrice, 10),
      quantity: Number.parseInt(raw.quantity, 10),
      freeDrinks: Number.parseInt(raw.freeDrinks, 10),
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
    controlName: 'packagePrice' | 'quantity' | 'freeDrinks',
    event: Event,
  ): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/\D+/g, '');
    const targetForm = form === 'create' ? this.createForm : this.editForm;
    targetForm.controls[controlName].setValue(sanitized, { emitEvent: false });
  }

  private drinkOptionsForCategory(categoryId: number | null): DropdownOption[] {
    if (categoryId == null) return [];
    return this.beverages()
      .filter((b) => b.categoryId === categoryId)
      .map((b) => ({ value: b.id, label: b.name }));
  }

  private syncCreateDrinkId(): void {
    const options = this.createDrinkOptions();
    const current = this.createForm.controls.drinkId.value;
    if (current > 0 && options.some((o) => o.value === current)) return;
    const first = options[0]?.value;
    this.createForm.controls.drinkId.setValue(typeof first === 'number' ? first : 0);
  }

  private syncEditDrinkId(): void {
    const options = this.editDrinkOptions();
    const current = this.editForm.controls.drinkId.value;
    if (current > 0 && options.some((o) => o.value === current)) return;
    const first = options[0]?.value;
    this.editForm.controls.drinkId.setValue(typeof first === 'number' ? first : 0);
  }
}
