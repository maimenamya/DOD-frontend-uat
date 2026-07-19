import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MasterListSkeletonComponent } from '../../components/master-list-skeleton/master-list-skeleton.component';
import {
  highlightInvalidForm,
  resetFormValidationFlag,
} from '../../utils/form-validation.util';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AppModalComponent } from '../../components/app-modal/app-modal.component';
import { ListPaginatorComponent } from '../../components/list-paginator/list-paginator.component';
import { MasterListToolbarComponent } from '../../components/master-list-toolbar/master-list-toolbar.component';
import { ShopDateInputComponent } from '../../components/shop-date-input/shop-date-input.component';
import type { TxnDailyExpense } from '../../models/daily-expense';
import { DailyExpenseService } from '../../services/daily-expense.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';
import {
  MasterListQueryState,
  createMasterListView,
  masterListRowNumber,
} from '../../utils/master-list.util';
import { shopCalendarTodayInput } from '../open-table/open-table-ledger.util';

function shopCalendarMonthStartInput(): string {
  const today = shopCalendarTodayInput();
  return `${today.slice(0, 7)}-01`;
}

@Component({
  selector: 'app-daily-expenses-page',
  imports: [MasterListSkeletonComponent, 
    DecimalPipe,
    FormsModule,
    ReactiveFormsModule,
    AppModalComponent,
    ShopDateInputComponent,
    MasterListToolbarComponent,
    ListPaginatorComponent,
  ],
  templateUrl: './daily-expenses-page.component.html',
})
export class DailyExpensesPageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly dailyExpenseService = inject(DailyExpenseService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly rangeFrom = signal(shopCalendarMonthStartInput());
  readonly rangeTo = signal(shopCalendarTodayInput());
  readonly rangeLabelFrom = signal('');
  readonly rangeLabelTo = signal('');

  readonly items = signal<TxnDailyExpense[]>([]);
  readonly listQuery = new MasterListQueryState();
  readonly listView = createMasterListView(this.items, this.listQuery, (item) =>
    `${item.description} ${item.businessDateLabel} ${item.businessDate}`,
  );
  readonly masterListRowNumber = masterListRowNumber;
  readonly totalAmount = signal(0);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly createFormValidated = signal(false);
  readonly editFormValidated = signal(false);
  readonly showCreateModal = signal(false);
  readonly editingItem = signal<TxnDailyExpense | null>(null);

  readonly hasItems = computed(() => this.items().length > 0);

  readonly createForm = this.fb.group({
    description: ['', Validators.required],
    amount: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    businessDate: [shopCalendarTodayInput(), Validators.required],
  });

  readonly editForm = this.fb.group({
    description: ['', Validators.required],
    amount: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    businessDate: ['', Validators.required],
  });

  ngOnInit(): void {
    this.loadItems();
  }

  onRangeFromChange(value: string): void {
    this.rangeFrom.set(value);
    this.reloadIfRangeValid();
  }

  onRangeToChange(value: string): void {
    this.rangeTo.set(value);
    this.reloadIfRangeValid();
  }

  private reloadIfRangeValid(): void {
    const from = this.rangeFrom().trim();
    const to = this.rangeTo().trim();
    if (!from || !to) return;
    if (from > to) {
      this.toast.showError('วันเริ่มต้องไม่หลังวันสิ้นสุด');
      return;
    }
    this.loadItems();
  }

  loadItems(): void {
    this.loading.set(true);
    this.showCreateModal.set(false);
    this.listQuery.resetPage();
    this.dailyExpenseService.list(this.rangeFrom(), this.rangeTo()).subscribe({
      next: (result) => {
        this.items.set(result.items);
        this.totalAmount.set(result.totalAmount);
        this.rangeLabelFrom.set(result.fromDate);
        this.rangeLabelTo.set(result.toDate);
        this.loading.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถโหลดรายการค่าใช้จ่ายได้');
        this.loading.set(false);
      },
    });
  }

  openCreate(): void {
    
    resetFormValidationFlag(this.createFormValidated);
    if (this.loading()) return;
    this.createForm.reset({
      description: '',
      amount: '',
      businessDate: shopCalendarTodayInput(),
    });
    this.showCreateModal.set(true);
  }

  closeCreate(): void {
    this.showCreateModal.set(false);
  }

  openEdit(item: TxnDailyExpense): void {
    
    resetFormValidationFlag(this.editFormValidated);
    this.editForm.reset({
      description: item.description,
      amount: String(item.amount),
      businessDate: item.businessDate,
    });
    this.editingItem.set(item);
  }

  closeEdit(): void {
    this.editingItem.set(null);
  }

  private payloadFromForm(form: typeof this.createForm) {
    const raw = form.getRawValue();
    return {
      description: raw.description.trim(),
      amount: Number.parseInt(raw.amount, 10),
      businessDate: raw.businessDate,
    };
  }

  submitCreate(): void {
    if (this.submitting()) return;
    if (highlightInvalidForm(this.createForm, this.createFormValidated, this.toast)) return;
    this.submitting.set(true);
    this.dailyExpenseService.create(this.payloadFromForm(this.createForm)).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeCreate();
        this.toast.showSuccess('บันทึกค่าใช้จ่ายเรียบร้อย');
        this.loadItems();
      },
      error: (err: { error?: { error?: string } }) => {
        this.submitting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถบันทึกค่าใช้จ่ายได้');
      },
    });
  }

  submitEdit(): void {
    const item = this.editingItem();
    if (!item || this.submitting()) return;
    if (highlightInvalidForm(this.editForm, this.editFormValidated, this.toast)) return;
    this.submitting.set(true);
    this.dailyExpenseService.update(item.id, this.payloadFromForm(this.editForm)).subscribe({
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

  async confirmDelete(item: TxnDailyExpense): Promise<void> {
    const ok = await this.confirmDialog.confirmDelete(
      `รายการ "${item.description}" วันที่ ${item.businessDateLabel}`,
    );
    if (!ok) return;
    this.dailyExpenseService.delete(item.id).subscribe({
      next: () => {
        this.toast.showSuccess('ลบรายการเรียบร้อย');
        this.loadItems();
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถลบรายการได้');
      },
    });
  }

  sanitizeAmountInput(form: 'create' | 'edit', event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/\D+/g, '');
    const targetForm = form === 'create' ? this.createForm : this.editForm;
    targetForm.controls.amount.setValue(sanitized, { emitEvent: false });
  }
}
