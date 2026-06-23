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

import { AppModalComponent } from '../../components/app-modal/app-modal.component';
import { ListPaginatorComponent } from '../../components/list-paginator/list-paginator.component';
import { MasterListToolbarComponent } from '../../components/master-list-toolbar/master-list-toolbar.component';
import type { MstStockItem } from '../../models/beverage-stock';
import { AuthService } from '../../services/auth.service';
import { BeverageStockService } from '../../services/beverage-stock.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';
import {
  MasterListQueryState,
  createMasterListView,
  masterListRowNumber,
} from '../../utils/master-list.util';

@Component({
  selector: 'app-stock-page',
  imports: [ReactiveFormsModule, AppModalComponent, DecimalPipe, MasterListToolbarComponent, ListPaginatorComponent],
  templateUrl: './stock-page.component.html',
})
export class StockPageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly stockService = inject(BeverageStockService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly canManage = computed(() => this.auth.canWriteOnPage('master_data'));
  readonly items = signal<MstStockItem[]>([]);
  readonly listQuery = new MasterListQueryState();
  readonly listView = createMasterListView(this.items, this.listQuery, (row) =>
    `${row.name} ${row.unitLabelTh}`,
  );
  readonly masterListRowNumber = masterListRowNumber;
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly createFormValidated = signal(false);
  readonly editFormValidated = signal(false);
  readonly showCreateModal = signal(false);
  readonly editingItem = signal<MstStockItem | null>(null);

  readonly selectedCreateStockItem = computed(() => {
    const name = this.createForm.controls.name.value.trim().toLowerCase();
    if (!name) return null;
    return this.items().find((row) => row.name.trim().toLowerCase() === name) ?? null;
  });

  readonly createForm = this.fb.group({
    name: ['', Validators.required],
    unitLabelTh: ['ขวด', Validators.required],
    quantityOnHand: ['1', [Validators.required, Validators.pattern(/^[1-9]\d*$/)]],
  });

  readonly editForm = this.fb.group({
    quantityOnHand: ['0', [Validators.required, Validators.pattern(/^\d+$/)]],
  });

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.stockService.getAll().subscribe({
      next: (stock) => {
        this.items.set(stock);
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
    this.createForm.reset({ name: '', unitLabelTh: 'ขวด', quantityOnHand: '1' });
    this.showCreateModal.set(true);
  }

  closeCreate(): void {
    this.showCreateModal.set(false);
  }

  openEdit(item: MstStockItem): void {
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

    const name = this.createForm.controls.name.value.trim();
    const unitLabelTh = this.createForm.controls.unitLabelTh.value.trim();
    const quantityOnHand = Number(this.createForm.controls.quantityOnHand.value);

    this.submitting.set(true);
    this.stockService
      .create({
        name,
        unitLabelTh,
        quantityOnHand,
      })
      .subscribe({
        next: () => {
          const existing = this.selectedCreateStockItem();
          this.toast.showSuccess(existing ? 'เพิ่มจำนวนสต็อกแล้ว' : 'เพิ่มรายการสต็อกแล้ว');
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
    this.stockService
      .updateQuantity(item.id, {
        quantityOnHand,
      })
      .subscribe({
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

  async confirmRemove(item: MstStockItem): Promise<void> {
    if (!this.canManage()) return;
    const linked = item.beverages?.length ?? 0;
    const linkedHint =
      linked > 0
        ? ` เมนู ${linked} รายการที่ผูกอยู่จะเลิกผูกสต็อก (ไม่ลบเมนู).`
        : '';
    const ok = await this.confirmDialog.confirm({
      title: 'ลบรายการสต็อก',
      message: `ลบ "${item.name}" ออกจากสต็อก?${linkedHint}`,
      confirmLabel: 'ลบ',
    });
    if (!ok) return;

    this.stockService.remove(item.id).subscribe({
      next: () => {
        this.toast.showSuccess('ลบรายการสต็อกแล้ว');
        this.reload();
      },
      error: (err) => {
        this.toast.showError(err?.error?.error ?? 'ลบไม่สำเร็จ');
      },
    });
  }
}
