import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MasterListSkeletonComponent } from '../../components/master-list-skeleton/master-list-skeleton.component';
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
import { AppThumbImageComponent } from '../../components/app-thumb-image/app-thumb-image.component';
import { ListPaginatorComponent } from '../../components/list-paginator/list-paginator.component';
import { MasterListToolbarComponent } from '../../components/master-list-toolbar/master-list-toolbar.component';
import type { MstCocktail } from '../../models/master-data';
import { AuthService } from '../../services/auth.service';
import { ShopMasterService } from '../../services/shop-master.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';
import {
  MasterListQueryState,
  createMasterListView,
  masterListRowNumber,
} from '../../utils/master-list.util';
import { prepareMenuThumbnail } from '../../utils/menu-thumbnail.util';
import { FieldErrorComponent } from '../../components/field-error/field-error.component';

@Component({
  selector: 'app-master-cocktail-page',
  imports: [
    FieldErrorComponent,
    MasterListSkeletonComponent, ReactiveFormsModule, AppModalComponent, AppThumbImageComponent, MasterListToolbarComponent, ListPaginatorComponent],
  templateUrl: './master-cocktail-page.component.html',
})
export class MasterCocktailPageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly shopMaster = inject(ShopMasterService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly canManage = computed(() => this.auth.canWriteOnPage('master_data'));
  readonly cocktails = signal<MstCocktail[]>([]);
  readonly listQuery = new MasterListQueryState();
  readonly listView = createMasterListView(this.cocktails, this.listQuery, (item) => item.name);
  readonly masterListRowNumber = masterListRowNumber;
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly uploadingImage = signal(false);
  readonly createFormValidated = signal(false);
  readonly editFormValidated = signal(false);
  readonly editingItem = signal<MstCocktail | null>(null);
  readonly showCreateModal = signal(false);

  readonly createForm = this.fb.group({
    name: ['', Validators.required],
    drinkValue: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    unitLabelTh: ['แก้ว', Validators.required],
  });

  readonly editForm = this.fb.group({
    name: ['', Validators.required],
    drinkValue: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    unitLabelTh: ['แก้ว', Validators.required],
    changeReason: ['', Validators.minLength(3)],
  });

  ngOnInit(): void {
    this.loadItems();
  }

  loadItems(): void {
    this.loading.set(true);
    this.showCreateModal.set(false);
    this.shopMaster.getCocktails().subscribe({
      next: (items) => {
        this.cocktails.set(items);
        this.loading.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถโหลดข้อมูลค็อกเทลได้');
        this.loading.set(false);
      },
    });
  }

  openCreate(): void {
    
    resetFormValidationFlag(this.createFormValidated);
    if (this.loading()) return;
    this.createForm.reset({ name: '', drinkValue: '', unitLabelTh: 'แก้ว' });
    this.showCreateModal.set(true);
  }

  closeCreate(): void {
    this.showCreateModal.set(false);
  }

  openEdit(item: MstCocktail): void {
    
    resetFormValidationFlag(this.editFormValidated);
    this.editForm.reset({
      name: item.name,
      drinkValue: String(item.drinkValue),
      unitLabelTh: item.unitLabelTh || 'แก้ว',
      changeReason: '',
    });
    this.editingItem.set(item);
  }

  closeEdit(): void {
    this.editingItem.set(null);
  }

  async onPickCocktailImage(event: Event): Promise<void> {
    const item = this.editingItem();
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!item || !file || this.uploadingImage()) return;
    this.uploadingImage.set(true);
    try {
      const thumb = await prepareMenuThumbnail(file);
      this.shopMaster.uploadCocktailImage(item.id, thumb.blob, thumb.fileName).subscribe({
        next: (updated) => {
          this.uploadingImage.set(false);
          this.editingItem.set(updated);
          this.cocktails.update((rows) =>
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

  removeCocktailImage(): void {
    const item = this.editingItem();
    if (!item?.imageUrl || this.uploadingImage()) return;
    this.uploadingImage.set(true);
    this.shopMaster.deleteCocktailImage(item.id).subscribe({
      next: (updated) => {
        this.uploadingImage.set(false);
        this.editingItem.set(updated);
        this.cocktails.update((rows) =>
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

  submitCreate(): void {
    if (this.submitting()) return;
    if (highlightInvalidForm(this.createForm, this.createFormValidated)) return;
    this.submitting.set(true);
    const { name, drinkValue, unitLabelTh } = this.createForm.getRawValue();
    this.shopMaster
      .createCocktail({
        name: name.trim(),
        drinkValue: Number.parseInt(drinkValue, 10),
        unitLabelTh: unitLabelTh.trim(),
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.closeCreate();
          this.toast.showSuccess('เพิ่มค็อกเทลเรียบร้อย');
          this.loadItems();
        },
        error: (err: { error?: { error?: string } }) => {
          this.submitting.set(false);
          this.toast.showError(err.error?.error ?? 'ไม่สามารถเพิ่มค็อกเทลได้');
        },
      });
  }

  submitEdit(): void {
    const item = this.editingItem();
    if (!item || this.submitting()) return;
    if (highlightInvalidForm(this.editForm, this.editFormValidated)) return;
    this.submitting.set(true);
    const { name, drinkValue, unitLabelTh, changeReason } = this.editForm.getRawValue();
    this.shopMaster
      .updateCocktail(item.id, {
        name: name.trim(),
        drinkValue: Number.parseInt(drinkValue, 10),
        unitLabelTh: unitLabelTh.trim(),
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
          this.toast.showError(err.error?.error ?? 'ไม่สามารถแก้ไขค็อกเทลได้');
        },
      });
  }

  async confirmDelete(item: MstCocktail): Promise<void> {
    const changeReason = await this.confirmDialog.confirmDeleteWithReason(`ค็อกเทล "${item.name}"`);
    if (!changeReason) return;
    this.shopMaster.deleteCocktail(item.id, changeReason).subscribe({
      next: () => {
        this.toast.showSuccess('ลบค็อกเทลเรียบร้อย');
        this.loadItems();
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถลบค็อกเทลได้');
      },
    });
  }

  sanitizeIntegerInput(form: 'create' | 'edit', event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/\D+/g, '');
    const targetForm = form === 'create' ? this.createForm : this.editForm;
    targetForm.controls.drinkValue.setValue(sanitized, { emitEvent: false });
  }
}
