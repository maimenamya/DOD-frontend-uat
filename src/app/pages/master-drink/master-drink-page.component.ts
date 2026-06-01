import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { AppModalComponent } from '../../components/app-modal/app-modal.component';
import type { MstBeverage } from '../../models/beverage';
import { AuthService } from '../../services/auth.service';
import { BeverageService } from '../../services/beverage.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-master-drink-page',
  imports: [DecimalPipe, ReactiveFormsModule, AppModalComponent],
  templateUrl: './master-drink-page.component.html',
})
export class MasterDrinkPageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly beverageService = inject(BeverageService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly canManage = computed(() => this.auth.canAccessTeamManagement());
  readonly beverages = signal<MstBeverage[]>([]);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly editingBeverage = signal<MstBeverage | null>(null);
  readonly showCreateModal = signal(false);

  readonly createForm = this.fb.group({
    name: ['', Validators.required],
    price: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    unitLabelTh: ['', Validators.required],
    isMixer: [false],
    canReturn: [false],
  });

  readonly editForm = this.fb.group({
    name: ['', Validators.required],
    price: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    unitLabelTh: ['', Validators.required],
    isMixer: [false],
    canReturn: [false],
  });

  ngOnInit(): void {
    this.loadBeverages();
  }

  loadBeverages(): void {
    this.loading.set(true);
    this.showCreateModal.set(false);
    this.beverageService.getBeverages().subscribe({
      next: (items) => {
        this.beverages.set(items);
        this.loading.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถโหลดข้อมูลเครื่องดื่มได้');
        this.loading.set(false);
      },
    });
  }

  openCreate(): void {
    if (this.loading()) return;
    this.createForm.reset({ name: '', price: '', unitLabelTh: '', isMixer: false, canReturn: false });
    this.showCreateModal.set(true);
  }

  closeCreate(): void {
    this.showCreateModal.set(false);
  }

  openEdit(item: MstBeverage): void {
    this.editForm.reset({
      name: item.name,
      price: String(item.price),
      unitLabelTh: item.unitLabelTh || '',
      isMixer: Boolean(item.isMixer),
      canReturn: Boolean(item.canReturn),
    });
    this.editingBeverage.set(item);
  }

  closeEdit(): void {
    this.editingBeverage.set(null);
  }

  submitCreate(): void {
    if (this.createForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    const { name, price, unitLabelTh, isMixer, canReturn } = this.createForm.getRawValue();
    this.beverageService
      .createBeverage({
        name,
        price: Number.parseInt(price, 10),
        unitLabelTh: unitLabelTh.trim(),
        isMixer,
        canReturn,
      })
      .subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeCreate();
        this.toast.showSuccess('เพิ่มเครื่องดื่มเรียบร้อย');
        this.loadBeverages();
      },
      error: (err: { error?: { error?: string } }) => {
        this.submitting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถเพิ่มเครื่องดื่มได้');
      },
    });
  }

  submitEdit(): void {
    const item = this.editingBeverage();
    if (!item || this.editForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    const { name, price, unitLabelTh, isMixer, canReturn } = this.editForm.getRawValue();
    this.beverageService
      .updateBeverage(item.id, {
        name,
        price: Number.parseInt(price, 10),
        unitLabelTh: unitLabelTh.trim(),
        isMixer,
        canReturn,
      })
      .subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeEdit();
        this.toast.showSuccess('บันทึกการแก้ไขเรียบร้อย');
        this.loadBeverages();
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
        this.loadBeverages();
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
