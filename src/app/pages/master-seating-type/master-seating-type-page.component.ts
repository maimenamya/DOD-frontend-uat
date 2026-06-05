import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { AppModalComponent } from '../../components/app-modal/app-modal.component';
import type { MstSeatingType } from '../../models/seating';
import { AuthService } from '../../services/auth.service';
import { ShopMasterService } from '../../services/shop-master.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-master-seating-type-page',
  imports: [ReactiveFormsModule, AppModalComponent],
  templateUrl: './master-seating-type-page.component.html',
})
export class MasterSeatingTypePageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly shopMaster = inject(ShopMasterService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly canManage = computed(() => this.auth.canWriteOnPage('master_data'));
  readonly items = signal<MstSeatingType[]>([]);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly editingItem = signal<MstSeatingType | null>(null);
  readonly showCreateModal = signal(false);

  readonly createForm = this.fb.group({
    name: ['', Validators.required],
    code: ['', Validators.required],
    description: [''],
  });

  readonly editForm = this.fb.group({
    name: ['', Validators.required],
    code: ['', Validators.required],
    description: [''],
  });

  ngOnInit(): void {
    this.loadItems();
  }

  loadItems(): void {
    this.loading.set(true);
    this.showCreateModal.set(false);
    this.shopMaster.getSeatingTypes().subscribe({
      next: (rows) => {
        this.items.set(rows);
        this.loading.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถโหลดประเภทที่นั่งได้');
        this.loading.set(false);
      },
    });
  }

  openCreate(): void {
    if (this.loading()) return;
    this.createForm.reset({ name: '', code: '', description: '' });
    this.showCreateModal.set(true);
  }

  closeCreate(): void {
    this.showCreateModal.set(false);
  }

  openEdit(item: MstSeatingType): void {
    this.editForm.reset({
      name: item.name,
      code: item.code,
      description: item.description ?? '',
    });
    this.editingItem.set(item);
  }

  closeEdit(): void {
    this.editingItem.set(null);
  }

  private payloadFromForm(form: typeof this.createForm) {
    const raw = form.getRawValue();
    return {
      name: raw.name,
      code: raw.code,
      description: raw.description.trim() || null,
      rateType: 'NONE' as const,
      basePrice: 0,
      minimumSpend: 0,
    };
  }

  submitCreate(): void {
    if (this.createForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.shopMaster.createSeatingType(this.payloadFromForm(this.createForm)).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeCreate();
        this.toast.showSuccess('เพิ่มประเภทที่นั่งเรียบร้อย');
        this.loadItems();
      },
      error: (err: { error?: { error?: string } }) => {
        this.submitting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถเพิ่มประเภทที่นั่งได้');
      },
    });
  }

  submitEdit(): void {
    const item = this.editingItem();
    if (!item || this.editForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.shopMaster.updateSeatingType(item.id, this.payloadFromForm(this.editForm)).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeEdit();
        this.toast.showSuccess('บันทึกการแก้ไขเรียบร้อย');
        this.loadItems();
      },
      error: (err: { error?: { error?: string } }) => {
        this.submitting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถแก้ไขประเภทที่นั่งได้');
      },
    });
  }

  async confirmDelete(item: MstSeatingType): Promise<void> {
    const ok = await this.confirmDialog.confirmDelete(`ประเภท "${item.name}"`);
    if (!ok) return;
    this.shopMaster.deleteSeatingType(item.id).subscribe({
      next: () => {
        this.toast.showSuccess('ลบประเภทที่นั่งเรียบร้อย');
        this.loadItems();
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถลบประเภทที่นั่งได้');
      },
    });
  }
}
