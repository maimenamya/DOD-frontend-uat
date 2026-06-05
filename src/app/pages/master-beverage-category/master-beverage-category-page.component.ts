import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { AppModalComponent } from '../../components/app-modal/app-modal.component';
import type { MstBeverageCategory } from '../../models/beverage';
import { AuthService } from '../../services/auth.service';
import { ShopMasterService } from '../../services/shop-master.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';
import { isMixerCategoryKind } from '../../utils/beverage-category-kind.util';

@Component({
  selector: 'app-master-beverage-category-page',
  imports: [ReactiveFormsModule, AppModalComponent],
  templateUrl: './master-beverage-category-page.component.html',
})
export class MasterBeverageCategoryPageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly shopMaster = inject(ShopMasterService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly canManage = computed(() => this.auth.canWriteOnPage('master_data'));
  readonly categories = signal<MstBeverageCategory[]>([]);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly editingItem = signal<MstBeverageCategory | null>(null);
  readonly showCreateModal = signal(false);

  readonly createForm = this.fb.group({
    name: ['', Validators.required],
    isMixer: [false],
  });

  readonly editForm = this.fb.group({
    name: ['', Validators.required],
    isMixer: [false],
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
    if (this.loading()) return;
    this.createForm.reset({ name: '', isMixer: false });
    this.showCreateModal.set(true);
  }

  closeCreate(): void {
    this.showCreateModal.set(false);
  }

  openEdit(item: MstBeverageCategory): void {
    this.editForm.reset({
      name: item.name,
      isMixer: isMixerCategoryKind(item.kind),
    });
    this.editingItem.set(item);
  }

  closeEdit(): void {
    this.editingItem.set(null);
  }

  submitCreate(): void {
    if (this.createForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    const { name, isMixer } = this.createForm.getRawValue();
    this.shopMaster.createBeverageCategory({ name: name.trim(), isMixer }).subscribe({
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
    if (!item || this.editForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    const { name, isMixer } = this.editForm.getRawValue();
    this.shopMaster
      .updateBeverageCategory(item.id, { name: name.trim(), isMixer })
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
