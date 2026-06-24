import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  highlightInvalidForm,
  resetFormValidationFlag,
} from '../../utils/form-validation.util';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { AppModalComponent } from '../../components/app-modal/app-modal.component';
import { ListPaginatorComponent } from '../../components/list-paginator/list-paginator.component';
import { MasterListToolbarComponent } from '../../components/master-list-toolbar/master-list-toolbar.component';
import {
  CustomDropdownComponent,
  type DropdownOption,
} from '../../components/custom-dropdown/custom-dropdown.component';
import type { BeverageCategoryKind, MstBeverageCategory } from '../../models/beverage';
import { AuthService } from '../../services/auth.service';
import { ShopMasterService } from '../../services/shop-master.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';
import {
  BEVERAGE_CATEGORY_KIND_OPTIONS,
  beverageCategoryKindLabel,
  defaultBeverageCategoryKind,
  isMixerCategoryKind,
  normalizeBeverageCategoryKind,
} from '../../utils/beverage-category-kind.util';
import {
  MasterListQueryState,
  createMasterListView,
  masterListRowNumber,
} from '../../utils/master-list.util';

@Component({
  selector: 'app-master-beverage-category-page',
  imports: [
    ReactiveFormsModule,
    AppModalComponent,
    MasterListToolbarComponent,
    ListPaginatorComponent,
    CustomDropdownComponent,
  ],
  templateUrl: './master-beverage-category-page.component.html',
})
export class MasterBeverageCategoryPageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly shopMaster = inject(ShopMasterService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly canManage = computed(() => this.auth.canWriteOnPage('master_data'));
  readonly kindDropdownOptions: DropdownOption[] = BEVERAGE_CATEGORY_KIND_OPTIONS.map((row) => ({
    value: row.value,
    label: row.label,
  }));
  readonly beverageCategoryKindLabel = beverageCategoryKindLabel;
  readonly categories = signal<MstBeverageCategory[]>([]);
  readonly listQuery = new MasterListQueryState();
  readonly listView = createMasterListView(this.categories, this.listQuery, (item) =>
    `${item.name} ${beverageCategoryKindLabel(item.kind)}`,
  );
  readonly masterListRowNumber = masterListRowNumber;
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly createFormValidated = signal(false);
  readonly editFormValidated = signal(false);
  readonly editingItem = signal<MstBeverageCategory | null>(null);
  readonly showCreateModal = signal(false);

  readonly createForm = this.fb.group({
    name: ['', Validators.required],
    kind: [defaultBeverageCategoryKind() as BeverageCategoryKind, Validators.required],
  });

  readonly editForm = this.fb.group({
    name: ['', Validators.required],
    kind: [defaultBeverageCategoryKind() as BeverageCategoryKind, Validators.required],
  });

  ngOnInit(): void {
    this.loadItems();
  }

  isMixerCategory(item: MstBeverageCategory): boolean {
    return isMixerCategoryKind(item.kind);
  }

  loadItems(): void {
    this.loading.set(true);
    this.showCreateModal.set(false);
    this.shopMaster.getBeverageCategories().subscribe({
      next: (items) => {
        this.categories.set(items);
        this.loading.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถโหลดข้อมูลประเภทเครื่องดื่มได้');
        this.loading.set(false);
      },
    });
  }

  openCreate(): void {
    resetFormValidationFlag(this.createFormValidated);
    if (this.loading()) return;
    this.createForm.reset({ name: '', kind: defaultBeverageCategoryKind() });
    this.showCreateModal.set(true);
  }

  closeCreate(): void {
    this.showCreateModal.set(false);
  }

  openEdit(item: MstBeverageCategory): void {
    resetFormValidationFlag(this.editFormValidated);
    this.editForm.reset({
      name: item.name,
      kind: normalizeBeverageCategoryKind(item.kind),
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
    const { name, kind } = this.createForm.getRawValue();
    this.shopMaster.createBeverageCategory({ name: name.trim(), kind }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeCreate();
        this.toast.showSuccess('เพิ่มประเภทเครื่องดื่มเรียบร้อย');
        this.loadItems();
      },
      error: (err: { error?: { error?: string } }) => {
        this.submitting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถเพิ่มประเภทเครื่องดื่มได้');
      },
    });
  }

  submitEdit(): void {
    const item = this.editingItem();
    if (!item || this.submitting()) return;
    if (highlightInvalidForm(this.editForm, this.editFormValidated, this.toast)) return;
    this.submitting.set(true);
    const { name, kind } = this.editForm.getRawValue();
    this.shopMaster
      .updateBeverageCategory(item.id, { name: name.trim(), kind })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.closeEdit();
          this.toast.showSuccess('บันทึกการแก้ไขเรียบร้อย');
          this.loadItems();
        },
        error: (err: { error?: { error?: string } }) => {
          this.submitting.set(false);
          this.toast.showError(err.error?.error ?? 'ไม่สามารถแก้ไขประเภทเครื่องดื่มได้');
        },
      });
  }

  async confirmDelete(item: MstBeverageCategory): Promise<void> {
    const ok = await this.confirmDialog.confirmDelete(`ประเภทเครื่องดื่ม "${item.name}"`);
    if (!ok) return;
    this.shopMaster.deleteBeverageCategory(item.id).subscribe({
      next: () => {
        this.toast.showSuccess('ลบประเภทเครื่องดื่มเรียบร้อย');
        this.loadItems();
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถลบประเภทเครื่องดื่มได้');
      },
    });
  }
}
