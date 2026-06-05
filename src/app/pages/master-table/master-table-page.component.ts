import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { AppModalComponent } from '../../components/app-modal/app-modal.component';
import type { LoungeTable } from '../../models/master-data';
import { AuthService } from '../../services/auth.service';
import { ShopMasterService } from '../../services/shop-master.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-master-table-page',
  imports: [ReactiveFormsModule, AppModalComponent],
  templateUrl: './master-table-page.component.html',
})
export class MasterTablePageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly shopMaster = inject(ShopMasterService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly canManage = computed(() => this.auth.canWriteOnPage('master_data'));
  readonly tables = signal<LoungeTable[]>([]);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly editingItem = signal<LoungeTable | null>(null);
  readonly showCreateModal = signal(false);

  readonly createForm = this.fb.group({
    tableCode: ['', Validators.required],
  });

  readonly editForm = this.fb.group({
    tableCode: ['', Validators.required],
  });

  ngOnInit(): void {
    this.loadItems();
  }

  loadItems(): void {
    this.loading.set(true);
    this.showCreateModal.set(false);
    this.shopMaster.getTables().subscribe({
      next: (items) => {
        this.tables.set(items);
        this.loading.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถโหลดข้อมูลโต๊ะได้');
        this.loading.set(false);
      },
    });
  }

  openCreate(): void {
    if (this.loading()) return;
    this.createForm.reset({ tableCode: '' });
    this.showCreateModal.set(true);
  }

  closeCreate(): void {
    this.showCreateModal.set(false);
  }

  openEdit(item: LoungeTable): void {
    this.editForm.reset({ tableCode: item.tableCode });
    this.editingItem.set(item);
  }

  closeEdit(): void {
    this.editingItem.set(null);
  }

  submitCreate(): void {
    if (this.createForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    const { tableCode } = this.createForm.getRawValue();
    this.shopMaster.createTable({ tableCode }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeCreate();
        this.toast.showSuccess('เพิ่มโต๊ะเรียบร้อย');
        this.loadItems();
      },
      error: (err: { error?: { error?: string } }) => {
        this.submitting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถเพิ่มโต๊ะได้');
      },
    });
  }

  submitEdit(): void {
    const item = this.editingItem();
    if (!item || this.editForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    const { tableCode } = this.editForm.getRawValue();
    this.shopMaster.updateTable(item.id, { tableCode }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeEdit();
        this.toast.showSuccess('บันทึกการแก้ไขเรียบร้อย');
        this.loadItems();
      },
      error: (err: { error?: { error?: string } }) => {
        this.submitting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถแก้ไขโต๊ะได้');
      },
    });
  }

  async confirmDelete(item: LoungeTable): Promise<void> {
    const ok = await this.confirmDialog.confirmDelete(`โต๊ะ "${item.tableCode}"`);
    if (!ok) return;
    this.shopMaster.deleteTable(item.id).subscribe({
      next: () => {
        this.toast.showSuccess('ลบโต๊ะเรียบร้อย');
        this.loadItems();
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถลบโต๊ะได้');
      },
    });
  }
}
