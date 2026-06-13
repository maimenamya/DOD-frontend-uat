import { DecimalPipe } from '@angular/common';
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
import { forkJoin } from 'rxjs';

import { AppModalComponent } from '../../components/app-modal/app-modal.component';
import { CustomDropdownComponent } from '../../components/custom-dropdown/custom-dropdown.component';
import type { MstBeverage } from '../../models/beverage';
import type { MstBeverageStock } from '../../models/beverage-stock';
import { AuthService } from '../../services/auth.service';
import { BeverageService } from '../../services/beverage.service';
import { BeverageStockService } from '../../services/beverage-stock.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-stock-page',
  imports: [ReactiveFormsModule, AppModalComponent, CustomDropdownComponent, DecimalPipe],
  templateUrl: './stock-page.component.html',
})
export class StockPageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly stockService = inject(BeverageStockService);
  private readonly beverageService = inject(BeverageService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly canManage = computed(() => this.auth.canWriteOnPage('master_data'));
  readonly items = signal<MstBeverageStock[]>([]);
  readonly beverages = signal<MstBeverage[]>([]);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly createFormValidated = signal(false);
  readonly editFormValidated = signal(false);
  readonly showCreateModal = signal(false);
  readonly editingItem = signal<MstBeverageStock | null>(null);

  readonly beverageOptions = computed(() => {
    const tracked = new Set(this.items().map((row) => row.beverageId));
    return this.beverages()
      .filter((b) => !tracked.has(b.id))
      .map((b) => ({ value: b.id, label: b.name }));
  });

  readonly createForm = this.fb.group({
    beverageId: [0, [Validators.required, Validators.min(1)]],
    quantityOnHand: ['0', [Validators.required, Validators.pattern(/^\d+$/)]],
  });

  readonly editForm = this.fb.group({
    quantityOnHand: ['0', [Validators.required, Validators.pattern(/^\d+$/)]],
  });

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    forkJoin({
      stock: this.stockService.getAll(),
      beverages: this.beverageService.getBeverages(),
    }).subscribe({
      next: ({ stock, beverages }) => {
        this.items.set(stock);
        this.beverages.set(beverages);
        this.loading.set(false);
      },
      error: () => {
        this.toast.showError('โหลดข้อมูลสต็อกไม่สำเร็จ');
        this.loading.set(false);
      },
    });
  }

  openCreate(): void {
    resetFormValidationFlag(this.createFormValidated);
    this.createForm.reset({ beverageId: 0, quantityOnHand: '0' });
    this.showCreateModal.set(true);
  }

  closeCreate(): void {
    this.showCreateModal.set(false);
  }

  openEdit(item: MstBeverageStock): void {
    resetFormValidationFlag(this.editFormValidated);
    this.editingItem.set(item);
    this.editForm.reset({ quantityOnHand: String(item.quantityOnHand) });
  }

  closeEdit(): void {
    this.editingItem.set(null);
  }

  sanitizeIntegerInput(form: 'create' | 'edit', event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '');
    input.value = digits;
    if (form === 'create') {
      this.createForm.controls.quantityOnHand.setValue(digits);
    } else {
      this.editForm.controls.quantityOnHand.setValue(digits);
    }
  }

  submitCreate(): void {
    if (!this.canManage()) return;
    if (highlightInvalidForm(this.createForm, this.createFormValidated, this.toast)) return;

    const beverageId = this.createForm.controls.beverageId.value;
    const quantityOnHand = Number(this.createForm.controls.quantityOnHand.value);

    this.submitting.set(true);
    this.stockService.create({ beverageId, quantityOnHand }).subscribe({
      next: () => {
        this.toast.showSuccess('เพิ่มสต็อกแล้ว');
        this.closeCreate();
        this.reload();
        this.submitting.set(false);
      },
      error: (err) => {
        this.toast.showError(err?.error?.error ?? 'เพิ่มสต็อกไม่สำเร็จ');
        this.submitting.set(false);
      },
    });
  }

  submitEdit(): void {
    const item = this.editingItem();
    if (!item || !this.canManage()) return;
    if (highlightInvalidForm(this.editForm, this.editFormValidated, this.toast)) return;

    const quantityOnHand = Number(this.editForm.controls.quantityOnHand.value);
    this.submitting.set(true);
    this.stockService.updateQuantity(item.beverageId, quantityOnHand).subscribe({
      next: () => {
        this.toast.showSuccess('บันทึกจำนวนสต็อกแล้ว');
        this.closeEdit();
        this.reload();
        this.submitting.set(false);
      },
      error: (err) => {
        this.toast.showError(err?.error?.error ?? 'บันทึกไม่สำเร็จ');
        this.submitting.set(false);
      },
    });
  }

  async confirmRemove(item: MstBeverageStock): Promise<void> {
    if (!this.canManage()) return;
    const ok = await this.confirmDialog.confirm({
      title: 'ลบออกจากสต็อก',
      message: `หยุดติดตามสต็อก "${item.beverage.name}"? (ไม่ลบเครื่องดื่มจากเมนู)`,
      confirmLabel: 'ลบ',
    });
    if (!ok) return;

    this.stockService.remove(item.beverageId).subscribe({
      next: () => {
        this.toast.showSuccess('ลบออกจากสต็อกแล้ว');
        this.reload();
      },
      error: (err) => {
        this.toast.showError(err?.error?.error ?? 'ลบไม่สำเร็จ');
      },
    });
  }
}
