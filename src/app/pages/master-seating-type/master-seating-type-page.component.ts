import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { AppModalComponent } from '../../components/app-modal/app-modal.component';
import {
  CustomDropdownComponent,
  type DropdownOption,
} from '../../components/custom-dropdown/custom-dropdown.component';
import type { SeatingRateType, MstSeatingType } from '../../models/seating';
import { AuthService } from '../../services/auth.service';
import { ShopMasterService } from '../../services/shop-master.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';

const RATE_TYPE_OPTIONS: DropdownOption[] = [
  { value: 'NONE', label: 'ไม่คิดค่าเวลา' },
  { value: 'HOURLY', label: 'รายชั่วโมง' },
  { value: 'FLAT_RATE', label: 'ราคาเหมา (ต่อครั้ง)' },
];

@Component({
  selector: 'app-master-seating-type-page',
  imports: [DecimalPipe, ReactiveFormsModule, AppModalComponent, CustomDropdownComponent],
  templateUrl: './master-seating-type-page.component.html',
})
export class MasterSeatingTypePageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly shopMaster = inject(ShopMasterService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly rateTypeOptions = RATE_TYPE_OPTIONS;
  readonly canManage = computed(() => this.auth.canAccessTeamManagement());
  readonly items = signal<MstSeatingType[]>([]);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly editingItem = signal<MstSeatingType | null>(null);
  readonly showCreateModal = signal(false);
  readonly createRateTypeView = signal<SeatingRateType>('NONE');
  readonly editRateTypeView = signal<SeatingRateType>('NONE');

  readonly createForm = this.fb.group({
    name: ['', Validators.required],
    code: ['', Validators.required],
    description: [''],
    rateType: ['NONE' as SeatingRateType, Validators.required],
    basePrice: ['0', [Validators.required, Validators.pattern(/^\d+$/)]],
  });

  readonly editForm = this.fb.group({
    name: ['', Validators.required],
    code: ['', Validators.required],
    description: [''],
    rateType: ['NONE' as SeatingRateType, Validators.required],
    basePrice: ['0', [Validators.required, Validators.pattern(/^\d+$/)]],
  });

  ngOnInit(): void {
    this.loadItems();
    this.createForm.controls.rateType.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        const rateType = value as SeatingRateType;
        this.createRateTypeView.set(rateType);
        this.applyPriceFieldRules(this.createForm, rateType);
      });
    this.editForm.controls.rateType.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        const rateType = value as SeatingRateType;
        this.editRateTypeView.set(rateType);
        this.applyPriceFieldRules(this.editForm, rateType);
      });
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

  rateTypeLabel(type: SeatingRateType): string {
    const found = RATE_TYPE_OPTIONS.find((o) => o.value === type);
    return found?.label ?? type;
  }

  showsPriceField(rateType: SeatingRateType): boolean {
    return rateType !== 'NONE';
  }

  priceFieldLabel(rateType: SeatingRateType): string {
    if (rateType === 'HOURLY') return 'ราคาต่อชั่วโมง (บาท)';
    if (rateType === 'FLAT_RATE') return 'ราคาเหมา (บาท)';
    return 'ราคา (บาท)';
  }

  private applyPriceFieldRules(
    form: typeof this.createForm,
    rateType: SeatingRateType,
  ): void {
    const priceControl = form.controls.basePrice;
    if (rateType === 'NONE') {
      priceControl.clearValidators();
      priceControl.setValue('0');
    } else {
      priceControl.setValidators([Validators.required, Validators.pattern(/^\d+$/)]);
    }
    priceControl.updateValueAndValidity();
  }

  openCreate(): void {
    if (this.loading()) return;
    this.createForm.reset({
      name: '',
      code: '',
      description: '',
      rateType: 'NONE',
      basePrice: '0',
    });
    this.createRateTypeView.set('NONE');
    this.applyPriceFieldRules(this.createForm, 'NONE');
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
      rateType: item.rateType,
      basePrice: String(item.basePrice),
    });
    this.editRateTypeView.set(item.rateType);
    this.applyPriceFieldRules(this.editForm, item.rateType);
    this.editingItem.set(item);
  }

  closeEdit(): void {
    this.editingItem.set(null);
  }

  private payloadFromForm(form: typeof this.createForm) {
    const raw = form.getRawValue();
    const rateType = raw.rateType;
    return {
      name: raw.name,
      code: raw.code,
      description: raw.description.trim() || null,
      rateType,
      basePrice: rateType === 'NONE' ? 0 : Number(raw.basePrice),
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
