import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { MasterListSkeletonComponent } from '../../components/master-list-skeleton/master-list-skeleton.component';
import {
  highlightInvalidForm,
  resetFormValidationFlag,
} from '../../utils/form-validation.util';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
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
import { ListPaginatorComponent } from '../../components/list-paginator/list-paginator.component';
import { MasterListToolbarComponent } from '../../components/master-list-toolbar/master-list-toolbar.component';
import type { MstBeverage, MstBeverageCategory } from '../../models/beverage';
import type { MstStockItem } from '../../models/beverage-stock';
import { AuthService } from '../../services/auth.service';
import { BeverageService } from '../../services/beverage.service';
import { BeverageStockService } from '../../services/beverage-stock.service';
import { ShopMasterService } from '../../services/shop-master.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';
import { isMixerCategoryKind } from '../../utils/beverage-category-kind.util';
import { APP_MOBILE_MEDIA_QUERY, isAppMobileViewport } from '../../utils/app-viewport.util';
import {
  MasterListQueryState,
  createMasterListView,
  masterListRowNumber,
} from '../../utils/master-list.util';
import { prepareMenuThumbnail } from '../../utils/menu-thumbnail.util';

@Component({
  selector: 'app-master-drink-page',
  imports: [
    MasterListSkeletonComponent,
    DecimalPipe,
    FormsModule,
    ReactiveFormsModule,
    AppModalComponent,
    CustomDropdownComponent,
    RouterLink,
    MasterListToolbarComponent,
    ListPaginatorComponent,
  ],
  templateUrl: './master-drink-page.component.html',
  styleUrl: './master-drink-page.component.css',
})
export class MasterDrinkPageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly beverageService = inject(BeverageService);
  private readonly stockService = inject(BeverageStockService);
  private readonly shopMaster = inject(ShopMasterService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly destroyRef = inject(DestroyRef);

  readonly canManage = computed(() => this.auth.canWriteOnPage('master_data'));
  readonly beverages = signal<MstBeverage[]>([]);
  readonly stockItems = signal<MstStockItem[]>([]);
  readonly categories = signal<MstBeverageCategory[]>([]);
  readonly selectedCategoryId = signal<number | null>(null);
  readonly mobileViewport = signal(isAppMobileViewport());
  readonly categoryDropdownOptions = computed<DropdownOption[]>(() =>
    this.categories().map((category) => ({ value: category.id, label: category.name })),
  );
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly uploadingImage = signal(false);
  readonly createFormValidated = signal(false);
  readonly editFormValidated = signal(false);
  readonly editingBeverage = signal<MstBeverage | null>(null);
  readonly showCreateModal = signal(false);

  readonly filteredBeverages = computed(() => {
    const id = this.selectedCategoryId();
    if (id == null) return [];
    return this.beverages().filter((item) => item.categoryId === id);
  });

  readonly listQuery = new MasterListQueryState();
  readonly listView = createMasterListView(this.filteredBeverages, this.listQuery, (item) =>
    `${item.name} ${item.unitLabelTh} ${item.category?.name ?? ''}`,
  );
  readonly masterListRowNumber = masterListRowNumber;

  readonly selectedCategory = computed(() => {
    const id = this.selectedCategoryId();
    if (id == null) return null;
    return this.categories().find((c) => c.id === id) ?? null;
  });

  readonly isMixerCategoryTab = computed(() => {
    const kind = this.selectedCategory()?.kind;
    return kind != null && isMixerCategoryKind(kind);
  });

  readonly stockItemOptions = computed(() => [
    { value: 0, label: '— ไม่ผูกสต็อก —' },
    ...this.stockItems().map((item) => ({
      value: item.id,
      label: `${item.name} (คงเหลือ ${item.quantityOnHand} ${item.unitLabelTh})`,
    })),
  ]);

  readonly createForm = this.fb.group({
    name: ['', Validators.required],
    price: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    unitLabelTh: ['', Validators.required],
    canReturn: [false],
    stockItemId: [0],
  });

  readonly editForm = this.fb.group({
    name: ['', Validators.required],
    price: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    unitLabelTh: ['', Validators.required],
    canReturn: [false],
    stockItemId: [0],
    changeReason: ['', Validators.minLength(3)],
  });

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      const mq = window.matchMedia(APP_MOBILE_MEDIA_QUERY);
      const onChange = (): void => this.mobileViewport.set(mq.matches);
      mq.addEventListener('change', onChange);
      this.destroyRef.onDestroy(() => mq.removeEventListener('change', onChange));
    }
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
      stockItems: this.stockService.getAll(),
    }).subscribe({
      next: ({ beverages, categories, stockItems }) => {
        this.beverages.set(beverages);
        this.categories.set(categories);
        this.stockItems.set(stockItems);
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

  selectCategoryTab(categoryId: number | string | null): void {
    if (categoryId == null || categoryId === '') return;
    const id = typeof categoryId === 'number' ? categoryId : Number(categoryId);
    if (!Number.isFinite(id)) return;
    this.selectedCategoryId.set(id);
    this.listQuery.resetPage();
    this.showCreateModal.set(false);
    this.editingBeverage.set(null);
  }

  openCreate(): void {
    
    resetFormValidationFlag(this.createFormValidated);
    if (this.loading() || !this.selectedCategory()) return;
    this.createForm.reset({ name: '', price: '', unitLabelTh: '', canReturn: false, stockItemId: 0 });
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
      stockItemId: item.stockItemId ?? item.stockItem?.id ?? 0,
      changeReason: '',
    });
    this.editingBeverage.set(item);
  }

  closeEdit(): void {
    this.editingBeverage.set(null);
  }

  async onPickBeverageImage(event: Event): Promise<void> {
    const item = this.editingBeverage();
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!item || !file || this.uploadingImage()) return;
    this.uploadingImage.set(true);
    try {
      const thumb = await prepareMenuThumbnail(file);
      this.beverageService.uploadBeverageImage(item.id, thumb.blob, thumb.fileName).subscribe({
        next: (updated) => {
          this.uploadingImage.set(false);
          this.editingBeverage.set(updated);
          this.beverages.update((rows) =>
            rows.map((row) => (row.id === updated.id ? updated : row)),
          );
          this.toast.showSuccess('อัปโหลดรูปเรียบร้อย');
        },
        error: (err: { error?: { error?: string } }) => {
          this.uploadingImage.set(false);
          this.toast.showError(err.error?.error ?? 'ไม่สามารถอัปโหลดรูปได้');
        },
      });
    } catch (error) {
      this.uploadingImage.set(false);
      this.toast.showError(error instanceof Error ? error.message : 'ไม่สามารถย่อรูปได้');
    }
  }

  removeBeverageImage(): void {
    const item = this.editingBeverage();
    if (!item?.imageUrl || this.uploadingImage()) return;
    this.uploadingImage.set(true);
    this.beverageService.deleteBeverageImage(item.id).subscribe({
      next: (updated) => {
        this.uploadingImage.set(false);
        this.editingBeverage.set(updated);
        this.beverages.update((rows) =>
          rows.map((row) => (row.id === updated.id ? updated : row)),
        );
        this.toast.showSuccess('ลบรูปเรียบร้อย');
      },
      error: (err: { error?: { error?: string } }) => {
        this.uploadingImage.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถลบรูปได้');
      },
    });
  }

  stockItemLabel(item: MstBeverage): string {
    return item.stockItem?.name ?? '—';
  }

  private resolveStockItemId(value: number): number | null {
    return value > 0 ? value : null;
  }

  submitCreate(): void {
    const categoryId = this.selectedCategoryId();
    if (categoryId == null || this.submitting()) return;
    if (highlightInvalidForm(this.createForm, this.createFormValidated, this.toast)) return;
    this.submitting.set(true);
    const { name, price, unitLabelTh, canReturn, stockItemId } = this.createForm.getRawValue();
    this.beverageService
      .createBeverage({
        name,
        price: Number.parseInt(price, 10),
        categoryId,
        unitLabelTh: unitLabelTh.trim(),
        canReturn,
        stockItemId: this.resolveStockItemId(stockItemId),
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
    const { name, price, unitLabelTh, canReturn, stockItemId, changeReason } = this.editForm.getRawValue();
    this.beverageService
      .updateBeverage(item.id, {
        name,
        price: Number.parseInt(price, 10),
        unitLabelTh: unitLabelTh.trim(),
        canReturn,
        stockItemId: this.resolveStockItemId(stockItemId),
        changeReason: changeReason.trim(),
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
    const changeReason = await this.confirmDialog.confirmDeleteWithReason(`เครื่องดื่ม "${item.name}"`);
    if (!changeReason) return;
    this.beverageService.deleteBeverage(item.id, changeReason).subscribe({
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
