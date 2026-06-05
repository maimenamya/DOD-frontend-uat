import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { AppModalComponent } from '../../components/app-modal/app-modal.component';
import type { MstPrTag } from '../../models/pr-tag';
import { AuthService } from '../../services/auth.service';
import { PrTagService } from '../../services/pr-tag.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-master-pr-tag-page',
  imports: [DecimalPipe, ReactiveFormsModule, AppModalComponent],
  templateUrl: './master-pr-tag-page.component.html',
})
export class MasterPrTagPageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly prTagService = inject(PrTagService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly canManage = computed(() => this.auth.canWriteOnPage('master_data'));
  readonly items = signal<MstPrTag[]>([]);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly editingItem = signal<MstPrTag | null>(null);
  readonly showCreateModal = signal(false);

  readonly createForm = this.fb.group({
    name: ['', Validators.required],
    requiredWorkingDays: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    allowedOffDays: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    targetDrinks: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    guaranteeAmount: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    dropoutPayoutAmount: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    isActive: [true],
  });

  readonly editForm = this.fb.group({
    name: ['', Validators.required],
    requiredWorkingDays: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    allowedOffDays: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    targetDrinks: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    guaranteeAmount: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    dropoutPayoutAmount: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
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
    this.prTagService.getAllTags().subscribe({
      next: (rows) => {
        this.items.set(rows);
        this.loading.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถโหลดแพ็กเกจแท็กได้');
        this.loading.set(false);
      },
    });
  }

  openCreate(): void {
    if (this.loading()) return;
    this.createForm.reset({
      name: '',
      requiredWorkingDays: '',
      allowedOffDays: '',
      targetDrinks: '',
      guaranteeAmount: '',
      dropoutPayoutAmount: '',
      isActive: true,
    });
    this.showCreateModal.set(true);
  }

  closeCreate(): void {
    this.showCreateModal.set(false);
  }

  openEdit(item: MstPrTag): void {
    this.editForm.reset({
      name: item.name,
      requiredWorkingDays: String(item.requiredWorkingDays),
      allowedOffDays: String(item.allowedOffDays),
      targetDrinks: String(item.targetDrinks),
      guaranteeAmount: String(item.guaranteeAmount),
      dropoutPayoutAmount: String(item.dropoutPayoutAmount),
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
      requiredWorkingDays: Number.parseInt(raw.requiredWorkingDays, 10),
      allowedOffDays: Number.parseInt(raw.allowedOffDays, 10),
      targetDrinks: Number.parseInt(raw.targetDrinks, 10),
      guaranteeAmount: Number.parseInt(raw.guaranteeAmount, 10),
      dropoutPayoutAmount: Number.parseInt(raw.dropoutPayoutAmount, 10),
      isActive: raw.isActive,
    };
  }

  submitCreate(): void {
    if (this.createForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.prTagService.createTag(this.payloadFromForm(this.createForm)).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeCreate();
        this.toast.showSuccess('เพิ่มแพ็กเกจแท็กเรียบร้อย');
        this.loadItems();
      },
      error: (err: { error?: { error?: string } }) => {
        this.submitting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถเพิ่มแพ็กเกจแท็กได้');
      },
    });
  }

  submitEdit(): void {
    const item = this.editingItem();
    if (!item || this.editForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.prTagService.updateTag(item.id, this.payloadFromForm(this.editForm)).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeEdit();
        this.toast.showSuccess('บันทึกการแก้ไขเรียบร้อย');
        this.loadItems();
      },
      error: (err: { error?: { error?: string } }) => {
        this.submitting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถแก้ไขแพ็กเกจแท็กได้');
      },
    });
  }

  async confirmDelete(item: MstPrTag): Promise<void> {
    const ok = await this.confirmDialog.confirmDelete(`แพ็กเกจ "${item.name}"`);
    if (!ok) return;
    this.prTagService.deleteTag(item.id).subscribe({
      next: () => {
        this.toast.showSuccess('ลบแพ็กเกจแท็กเรียบร้อย');
        this.loadItems();
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถลบแพ็กเกจแท็กได้');
      },
    });
  }

  sanitizeIntegerInput(
    form: 'create' | 'edit',
    controlName:
      | 'requiredWorkingDays'
      | 'allowedOffDays'
      | 'targetDrinks'
      | 'guaranteeAmount'
      | 'dropoutPayoutAmount',
    event: Event,
  ): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/\D+/g, '');
    const targetForm = form === 'create' ? this.createForm : this.editForm;
    targetForm.controls[controlName].setValue(sanitized, { emitEvent: false });
  }
}
