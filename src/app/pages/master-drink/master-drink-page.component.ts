import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  highlightInvalidForm,
  resetFormValidationFlag,
} from '../../utils/form-validation.util';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { forkJoin } from 'rxjs';

import { AppModalComponent } from '../../components/app-modal/app-modal.component';
import type { MstBeverage, MstBeverageCategory } from '../../models/beverage';
import { AuthService } from '../../services/auth.service';
import { BeverageService } from '../../services/beverage.service';
import { ShopMasterService } from '../../services/shop-master.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';
import { isMixerCategoryKind } from '../../utils/beverage-category-kind.util';

@Component({
  selector: 'app-master-drink-page',
  imports: [DecimalPipe, ReactiveFormsModule, AppModalComponent, RouterLink],
  templateUrl: './master-drink-page.component.html',
})
export class MasterDrinkPageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly beverageService = inject(BeverageService);
  private readonly shopMaster = inject(ShopMasterService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly canManage = computed(() => this.auth.canWriteOnPage('master_data'));
  readonly beverages = signal<MstBeverage[]>([]);
  readonly categories = signal<MstBeverageCategory[]>([]);
  readonly selectedCategoryId = signal<number | null>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly createFormValidated = signal(false);
  readonly editFormValidated = signal(false);
  readonly editingBeverage = signal<MstBeverage | null>(null);
  readonly showCreateModal = signal(false);

  readonly filteredBeverages = computed(() => {
    const id = this.selectedCategoryId();
    if (id == null) return [];
    return this.beverages().filter((item) => item.categoryId === id);
  });

  readonly selectedCategory = computed(() => {
    const id = this.selectedCategoryId();
    if (id == null) return null;
    return this.categories().find((c) => c.id === id) ?? null;
  });

  readonly isMixerCategoryTab = computed(() => {
    const kind = this.selectedCategory()?.kind;
    return kind != null && isMixerCategoryKind(kind);
  });

  readonly createForm = this.fb.group({
    name: ['', Validators.required],
    price: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    unitLabelTh: ['', Validators.required],
    canReturn: [false],
  });

  readonly editForm = this.fb.group({
    name: ['', Validators.required],
    price: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    unitLabelTh: ['', Validators.required],
    canReturn: [false],
  });

  ngOnInit(): void {
    this.loadItems();
  }

  categoryName(item: MstBeverage): string {
    return item.category?.name ?? '—';
  }

  loadItems(): void {
    this.loading.set(true);
    this.showCreateModal.set(false);
    forkJoin({
      beverages: this.beverageService.getBeverages(),
      categories: this.shopMaster.getBeverageCategories(),
    }).subscribe({
      next: ({ beverages, categories }) => {
        this.beverages.set(beverages);
        this.categories.set(categories);
        this.syncSelectedCategory(categories);
        this.loading.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถโหลดข้อมูลเครื่องดื่มได้');
        this.loading.set(false);
      },
    });
  }

  private syncSelectedCategory(categories: MstBeverageCategory[]): void {
    if (categories.length === 0) {
      this.selectedCategoryId.set(null);
      return;
    }
    const current = this.selectedCategoryId();
    if (current != null && categories.some((c) => c.id === current)) return;
    this.selectedCategoryId.set(categories[0].id);
  }

  selectCategoryTab(categoryId: number): void {
    this.selectedCategoryId.set(categoryId);
    this.showCreateModal.set(false);
    this.editingBeverage.set(null);
  }

  openCreate(): void {
    
    resetFormValidationFlag(this.createFormValidated);
    if (this.loading() || !this.selectedCategory()) return;
    this.createForm.reset({ name: '', price: '', unitLabelTh: '', canReturn: false });
    this.showCreateModal.set(true);
  }

  closeCreate(): void {
    this.showCreateModal.set(false);
  }

  openEdit(item: MstBeverage): void {
    
    resetFormValidationFlag(this.editFormValidated);
    this.editForm.reset({
      name: item.name,
      price: String(item.price),
      unitLabelTh: item.unitLabelTh || '',
      canReturn: Boolean(item.canReturn),
    });
    this.editingBeverage.set(item);
  }

  closeEdit(): void {
    this.editingBeverage.set(null);
  }

  submitCreate(): void {
    const categoryId = this.selectedCategoryId();
    if (categoryId == null || this.submitting()) return;
    if (highlightInvalidForm(this.createForm, this.createFormValidated, this.toast)) return;
    this.submitting.set(true);
    const { name, price, unitLabelTh, canReturn } = this.createForm.getRawValue();
    this.beverageService
      .createBeverage({
        name,
        price: Number.parseInt(price, 10),
        categoryId,
        unitLabelTh: unitLabelTh.trim(),
        canReturn,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.closeCreate();
          this.toast.showSuccess('เพิ่มเครื่องดื่มเรียบร้อย');
          this.loadItems();
        },
        error: (err: { error?: { error?: string } }) => {
          this.submitting.set(false);
          this.toast.showError(err.error?.error ?? 'ไม่สามารถเพิ่มเครื่องดื่มได้');
        },
      });
  }

  submitEdit(): void {
    const item = this.editingBeverage();
    if (!item || this.submitting()) return;
    if (highlightInvalidForm(this.editForm, this.editFormValidated, this.toast)) return;
    this.submitting.set(true);
    const { name, price, unitLabelTh, canReturn } = this.editForm.getRawValue();
    this.beverageService
      .updateBeverage(item.id, {
        name,
        price: Number.parseInt(price, 10),
        unitLabelTh: unitLabelTh.trim(),
        canReturn,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.closeEdit();
          this.toast.showSuccess('บันทึกการแก้ไขเรียบร้อย');
          this.loadItems();
        },
        error: (err: { error?: { error?: string } }) => {
          this.submitting.set(false);
          this.toast.showError(err.error?.error ?? 'ไม่สามารถแก้ไขเครื่องดื่มได้');
        },
      });
  }

  async confirmDelete(item: MstBeverage): Promise<void> {
    const ok = await this.confirmDialog.confirmDelete(`เครื่องดื่ม "${item.name}"`);
    if (!ok) return;
    this.beverageService.deleteBeverage(item.id).subscribe({
      next: () => {
        this.toast.showSuccess('ลบเครื่องดื่มเรียบร้อย');
        this.loadItems();
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถลบเครื่องดื่มได้');
      },
    });
  }

  sanitizeIntegerInput(form: 'create' | 'edit', controlName: 'price', event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/\D+/g, '');
    const targetForm = form === 'create' ? this.createForm : this.editForm;
    targetForm.controls[controlName].setValue(sanitized, { emitEvent: false });
  }
}
