import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { AppModalComponent } from '../../components/app-modal/app-modal.component';
import type { MstOtherCharge } from '../../models/other-charge';
import { AuthService } from '../../services/auth.service';
import { OtherChargeService } from '../../services/other-charge.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-master-other-charge-page',
  imports: [DecimalPipe, ReactiveFormsModule, AppModalComponent],
  templateUrl: './master-other-charge-page.component.html',
})
export class MasterOtherChargePageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly otherChargeService = inject(OtherChargeService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly canManage = computed(() => this.auth.canWriteOnPage('master_data'));
  readonly items = signal<MstOtherCharge[]>([]);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly editingItem = signal<MstOtherCharge | null>(null);
  readonly showCreateModal = signal(false);

  readonly createForm = this.fb.group({
    name: ['', Validators.required],
    price: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    unitLabelTh: ['ครั้ง', Validators.required],
    isActive: [true],
  });

  readonly editForm = this.fb.group({
    name: ['', Validators.required],
    price: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    unitLabelTh: ['ครั้ง', Validators.required],
    isActive: [true],
  });

  ngOnInit(): void {
    this.loadItems();
  }

  activeLabel(value: boolean): string {
    return value ? 'ใช้งาน' : 'ปิด';
  }

  loadItems(): void {
    this.loading.set(true);
    this.showCreateModal.set(false);
    this.otherChargeService.getAll().subscribe({
      next: (rows) => {
        this.items.set(rows);
        this.loading.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถโหลดรายการอื่นๆ ได้');
        this.loading.set(false);
      },
    });
  }

  openCreate(): void {
    if (this.loading()) return;
    this.createForm.reset({
      name: '',
      price: '',
      unitLabelTh: 'ครั้ง',
      isActive: true,
    });
    this.showCreateModal.set(true);
  }

  closeCreate(): void {
    this.showCreateModal.set(false);
  }

  openEdit(item: MstOtherCharge): void {
    this.editForm.reset({
      name: item.name,
      price: String(item.price),
      unitLabelTh: item.unitLabelTh || 'ครั้ง',
      isActive: item.isActive,
    });
    this.editingItem.set(item);
  }

  closeEdit(): void {
    this.editingItem.set(null);
  }

  private payloadFromForm(form: typeof this.createForm) {
    const raw = form.getRawValue();
    return {
      name: raw.name.trim(),
      price: Number.parseInt(raw.price, 10),
      unitLabelTh: raw.unitLabelTh.trim(),
      isActive: raw.isActive,
    };
  }

  submitCreate(): void {
    if (this.createForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.otherChargeService.create(this.payloadFromForm(this.createForm)).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeCreate();
        this.toast.showSuccess('เพิ่มรายการเรียบร้อย');
        this.loadItems();
      },
      error: (err: { error?: { error?: string } }) => {
        this.submitting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถเพิ่มรายการได้');
      },
    });
  }

  submitEdit(): void {
    const item = this.editingItem();
    if (!item || this.editForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.otherChargeService.update(item.id, this.payloadFromForm(this.editForm)).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeEdit();
        this.toast.showSuccess('บันทึกการแก้ไขเรียบร้อย');
        this.loadItems();
      },
      error: (err: { error?: { error?: string } }) => {
        this.submitting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถแก้ไขรายการได้');
      },
    });
  }

  async confirmDelete(item: MstOtherCharge): Promise<void> {
    const ok = await this.confirmDialog.confirmDelete(`รายการ "${item.name}"`);
    if (!ok) return;
    this.otherChargeService.delete(item.id).subscribe({
      next: () => {
        this.toast.showSuccess('ลบรายการเรียบร้อย');
        this.loadItems();
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถลบรายการได้');
      },
    });
  }

  sanitizeIntegerInput(form: 'create' | 'edit', event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/\D+/g, '');
    const targetForm = form === 'create' ? this.createForm : this.editForm;
    targetForm.controls.price.setValue(sanitized, { emitEvent: false });
  }
}
