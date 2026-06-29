import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  highlightInvalidForm,
  resetFormValidationFlag,
} from '../../utils/form-validation.util';
import { DecimalPipe } from '@angular/common';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { AppModalComponent } from '../../components/app-modal/app-modal.component';
import { ListPaginatorComponent } from '../../components/list-paginator/list-paginator.component';
import { MasterListToolbarComponent } from '../../components/master-list-toolbar/master-list-toolbar.component';
import type { MstOtherCharge, OtherChargeGroup } from '../../models/other-charge';
import { OTHER_CHARGE_GROUP_LABELS } from '../../models/other-charge';
import { AuthService } from '../../services/auth.service';
import { OtherChargeService } from '../../services/other-charge.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';
import {
  MasterListQueryState,
  createMasterListView,
  masterListRowNumber,
} from '../../utils/master-list.util';

@Component({
  selector: 'app-master-other-charge-page',
  imports: [DecimalPipe, ReactiveFormsModule, AppModalComponent, MasterListToolbarComponent, ListPaginatorComponent],
  templateUrl: './master-other-charge-page.component.html',
})
export class MasterOtherChargePageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly otherChargeService = inject(OtherChargeService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly route = inject(ActivatedRoute);

  readonly chargeGroup = signal<OtherChargeGroup>('MISCELLANEOUS');
  readonly pageTitle = computed(() => OTHER_CHARGE_GROUP_LABELS[this.chargeGroup()]);
  readonly namePlaceholder = computed(() =>
    this.chargeGroup() === 'TABLE_OPENING'
      ? 'เช่น ค่าเปิดโต๊ะ VIP, ค่าเปิดโต๊ะธรรมดา'
      : 'เช่น ผ้าเย็น, สแน็ค 1 จาน',
  );
  readonly unitPlaceholder = computed(() =>
    this.chargeGroup() === 'TABLE_OPENING' ? 'เช่น โต๊ะ, ครั้ง' : 'เช่น จาน, ผืน',
  );

  readonly canManage = computed(() => this.auth.canWriteOnPage('master_data'));
  readonly items = signal<MstOtherCharge[]>([]);
  readonly listQuery = new MasterListQueryState();
  readonly listView = createMasterListView(this.items, this.listQuery, (item) =>
    `${item.name} ${item.unitLabelTh}`,
  );
  readonly masterListRowNumber = masterListRowNumber;
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly createFormValidated = signal(false);
  readonly editFormValidated = signal(false);
  readonly editingItem = signal<MstOtherCharge | null>(null);
  readonly showCreateModal = signal(false);

  readonly createForm = this.fb.group({
    name: ['', Validators.required],
    price: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    unitLabelTh: ['', Validators.required],
    isActive: [true],
  });

  readonly editForm = this.fb.group({
    name: ['', Validators.required],
    price: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    unitLabelTh: ['', Validators.required],
    isActive: [true],
  });

  ngOnInit(): void {
    this.route.data.subscribe((data) => {
      const group = data['otherChargeGroup'] as OtherChargeGroup | undefined;
      this.chargeGroup.set(group === 'TABLE_OPENING' ? 'TABLE_OPENING' : 'MISCELLANEOUS');
      this.loadItems();
    });
  }

  activeLabel(value: boolean): string {
    return value ? 'ใช้งาน' : 'ปิด';
  }

  loadItems(): void {
    this.loading.set(true);
    this.showCreateModal.set(false);
    this.otherChargeService.getAll(this.chargeGroup()).subscribe({
      next: (rows) => {
        this.items.set(rows);
        this.loading.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? `ไม่สามารถโหลด${this.pageTitle()}ได้`);
        this.loading.set(false);
      },
    });
  }

  openCreate(): void {
    resetFormValidationFlag(this.createFormValidated);
    if (this.loading()) return;
    this.createForm.reset({
      name: '',
      price: '',
      unitLabelTh: '',
      isActive: true,
    });
    this.showCreateModal.set(true);
  }

  closeCreate(): void {
    this.showCreateModal.set(false);
  }

  openEdit(item: MstOtherCharge): void {
    resetFormValidationFlag(this.editFormValidated);
    this.editForm.reset({
      name: item.name,
      price: String(item.price),
      unitLabelTh: item.unitLabelTh,
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
      chargeGroup: this.chargeGroup(),
    };
  }

  submitCreate(): void {
    if (this.submitting()) return;
    if (highlightInvalidForm(this.createForm, this.createFormValidated, this.toast)) return;
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
    if (!item || this.submitting()) return;
    if (highlightInvalidForm(this.editForm, this.editFormValidated, this.toast)) return;
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
