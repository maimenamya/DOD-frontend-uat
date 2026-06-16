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
import { ListPaginatorComponent } from '../../components/list-paginator/list-paginator.component';
import { MasterListToolbarComponent } from '../../components/master-list-toolbar/master-list-toolbar.component';
import type { MstFood, MstFoodCategory } from '../../models/master-data';
import { AuthService } from '../../services/auth.service';
import { ShopMasterService } from '../../services/shop-master.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';
import {
  MasterListQueryState,
  createMasterListView,
  masterListRowNumber,
} from '../../utils/master-list.util';

@Component({
  selector: 'app-master-food-page',
  imports: [DecimalPipe, ReactiveFormsModule, AppModalComponent, RouterLink, MasterListToolbarComponent, ListPaginatorComponent],
  templateUrl: './master-food-page.component.html',
})
export class MasterFoodPageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly shopMaster = inject(ShopMasterService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly canManage = computed(() => this.auth.canWriteOnPage('master_data'));
  readonly foods = signal<MstFood[]>([]);
  readonly categories = signal<MstFoodCategory[]>([]);
  readonly selectedCategoryId = signal<number | null>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly createFormValidated = signal(false);
  readonly editFormValidated = signal(false);
  readonly editingItem = signal<MstFood | null>(null);
  readonly showCreateModal = signal(false);

  readonly filteredFoods = computed(() => {
    const id = this.selectedCategoryId();
    if (id == null) return [];
    return this.foods().filter((item) => item.categoryId === id);
  });

  readonly listQuery = new MasterListQueryState();
  readonly listView = createMasterListView(this.filteredFoods, this.listQuery, (item) =>
    `${item.name} ${item.category?.name ?? ''}`,
  );
  readonly masterListRowNumber = masterListRowNumber;

  readonly selectedCategory = computed(() => {
    const id = this.selectedCategoryId();
    if (id == null) return null;
    return this.categories().find((c) => c.id === id) ?? null;
  });

  readonly createForm = this.fb.group({
    name: ['', Validators.required],
    price: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
  });

  readonly editForm = this.fb.group({
    name: ['', Validators.required],
    price: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
  });

  ngOnInit(): void {
    this.loadItems();
  }

  loadItems(): void {
    this.loading.set(true);
    this.showCreateModal.set(false);
    forkJoin({
      foods: this.shopMaster.getFoods(),
      categories: this.shopMaster.getFoodCategories(),
    }).subscribe({
      next: ({ foods, categories }) => {
        this.foods.set(foods);
        this.categories.set(categories);
        this.syncSelectedCategory(categories);
        this.loading.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถโหลดข้อมูลอาหารได้');
        this.loading.set(false);
      },
    });
  }

  categoryName(item: MstFood): string {
    return item.category?.name ?? '—';
  }

  private syncSelectedCategory(categories: MstFoodCategory[]): void {
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
    this.listQuery.resetPage();
    this.showCreateModal.set(false);
    this.editingItem.set(null);
  }

  openCreate(): void {
    
    resetFormValidationFlag(this.createFormValidated);
    if (this.loading() || !this.selectedCategory()) return;
    this.createForm.reset({ name: '', price: '' });
    this.showCreateModal.set(true);
  }

  closeCreate(): void {
    resetFormValidationFlag(this.createFormValidated);
    this.showCreateModal.set(false);
  }

  openEdit(item: MstFood): void {
    
    resetFormValidationFlag(this.editFormValidated);
    this.editForm.reset({
      name: item.name,
      price: String(item.price),
    });
    this.editingItem.set(item);
  }

  closeEdit(): void {
    resetFormValidationFlag(this.editFormValidated);
    this.editingItem.set(null);
  }

  submitCreate(): void {
    if (this.submitting()) return;
    if (highlightInvalidForm(this.createForm, this.createFormValidated, this.toast)) return;
    const category = this.selectedCategory();
    if (!category) {
      this.toast.showError('กรุณาเลือกประเภทอาหารก่อน');
      return;
    }
    this.submitting.set(true);
    const { name, price } = this.createForm.getRawValue();
    this.shopMaster
      .createFood({ name, price: Number.parseInt(price, 10), categoryId: category.id })
      .subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeCreate();
        this.toast.showSuccess('เพิ่มอาหารเรียบร้อย');
        this.loadItems();
      },
      error: (err: { error?: { error?: string } }) => {
        this.submitting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถเพิ่มอาหารได้');
      },
    });
  }

  submitEdit(): void {
    const item = this.editingItem();
    if (!item || this.submitting()) return;
    if (highlightInvalidForm(this.editForm, this.editFormValidated, this.toast)) return;
    this.submitting.set(true);
    const { name, price } = this.editForm.getRawValue();
    this.shopMaster
      .updateFood(item.id, { name, price: Number.parseInt(price, 10), categoryId: item.categoryId })
      .subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeEdit();
        this.toast.showSuccess('บันทึกการแก้ไขเรียบร้อย');
        this.loadItems();
      },
      error: (err: { error?: { error?: string } }) => {
        this.submitting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถแก้ไขอาหารได้');
      },
    });
  }

  async confirmDelete(item: MstFood): Promise<void> {
    const ok = await this.confirmDialog.confirmDelete(`อาหาร "${item.name}"`);
    if (!ok) return;
    this.shopMaster.deleteFood(item.id).subscribe({
      next: () => {
        this.toast.showSuccess('ลบอาหารเรียบร้อย');
        this.loadItems();
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถลบอาหารได้');
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
