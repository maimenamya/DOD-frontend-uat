import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { forkJoin } from 'rxjs';

import { AppModalComponent } from '../../components/app-modal/app-modal.component';
import {
  CustomDropdownComponent,
  type DropdownOption,
} from '../../components/custom-dropdown/custom-dropdown.component';
import type { MstMembership } from '../../models/master-data';
import { AuthService } from '../../services/auth.service';
import { BeverageService } from '../../services/beverage.service';
import { ShopMasterService } from '../../services/shop-master.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-master-membership-page',
  imports: [DecimalPipe, ReactiveFormsModule, AppModalComponent, CustomDropdownComponent],
  templateUrl: './master-membership-page.component.html',
})
export class MasterMembershipPageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly shopMaster = inject(ShopMasterService);
  private readonly beverageService = inject(BeverageService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly canManage = computed(() => this.auth.canAccessTeamManagement());
  readonly memberships = signal<MstMembership[]>([]);
  readonly drinkOptions = signal<DropdownOption[]>([]);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly editingItem = signal<MstMembership | null>(null);
  readonly showCreateModal = signal(false);

  readonly createForm = this.fb.group({
    name: ['', Validators.required],
    packagePrice: ['0', [Validators.required, Validators.pattern(/^\d+$/)]],
    drinkId: [0, [Validators.required, Validators.min(1)]],
    quantity: ['1', [Validators.required, Validators.pattern(/^\d+$/)]],
    isFreeMixer: [false],
    freeDrinks: ['0', [Validators.required, Validators.pattern(/^\d+$/)]],
  });

  readonly editForm = this.fb.group({
    name: ['', Validators.required],
    packagePrice: ['0', [Validators.required, Validators.pattern(/^\d+$/)]],
    drinkId: [0, [Validators.required, Validators.min(1)]],
    quantity: ['1', [Validators.required, Validators.pattern(/^\d+$/)]],
    isFreeMixer: [false],
    freeDrinks: ['0', [Validators.required, Validators.pattern(/^\d+$/)]],
  });

  ngOnInit(): void {
    this.loadItems();
  }

  loadItems(): void {
    this.loading.set(true);
    this.showCreateModal.set(false);
    forkJoin({
      memberships: this.shopMaster.getMemberships(),
      beverages: this.beverageService.getBeverages(),
    }).subscribe({
      next: ({ memberships, beverages }) => {
        this.memberships.set(memberships);
        this.drinkOptions.set(
          beverages.map((b) => ({ value: b.id, label: b.name })),
        );
        this.loading.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถโหลดข้อมูลเมมเบอร์ได้');
        this.loading.set(false);
      },
    });
  }

  drinkName(item: MstMembership): string {
    return item.drink?.name ?? '—';
  }

  freeMixerLabel(value: boolean): string {
    return value ? 'ใช่' : 'ไม่';
  }

  openCreate(): void {
    if (this.loading()) return;
    const firstDrinkId = this.drinkOptions()[0]?.value as number | undefined;
    this.createForm.reset({
      name: '',
      packagePrice: '0',
      drinkId: firstDrinkId ?? 0,
      quantity: '1',
      isFreeMixer: false,
      freeDrinks: '0',
    });
    this.showCreateModal.set(true);
  }

  closeCreate(): void {
    this.showCreateModal.set(false);
  }

  openEdit(item: MstMembership): void {
    this.editForm.reset({
      name: item.name,
      packagePrice: String(item.packagePrice),
      drinkId: item.drinkId,
      quantity: String(item.quantity),
      isFreeMixer: item.isFreeMixer,
      freeDrinks: String(item.freeDrinks ?? 0),
    });
    this.editingItem.set(item);
  }

  closeEdit(): void {
    this.editingItem.set(null);
  }

  submitCreate(): void {
    if (this.createForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    const raw = this.createForm.getRawValue();
    const payload = {
      ...raw,
      packagePrice: Number.parseInt(raw.packagePrice, 10),
      quantity: Number.parseInt(raw.quantity, 10),
      freeDrinks: Number.parseInt(raw.freeDrinks, 10),
    };
    this.shopMaster.createMembership(payload).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeCreate();
        this.toast.showSuccess('เพิ่มเมมเบอร์เรียบร้อย');
        this.loadItems();
      },
      error: (err: { error?: { error?: string } }) => {
        this.submitting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถเพิ่มเมมเบอร์ได้');
      },
    });
  }

  submitEdit(): void {
    const item = this.editingItem();
    if (!item || this.editForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    const raw = this.editForm.getRawValue();
    const payload = {
      ...raw,
      packagePrice: Number.parseInt(raw.packagePrice, 10),
      quantity: Number.parseInt(raw.quantity, 10),
      freeDrinks: Number.parseInt(raw.freeDrinks, 10),
    };
    this.shopMaster.updateMembership(item.id, payload).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeEdit();
        this.toast.showSuccess('บันทึกการแก้ไขเรียบร้อย');
        this.loadItems();
      },
      error: (err: { error?: { error?: string } }) => {
        this.submitting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถแก้ไขเมมเบอร์ได้');
      },
    });
  }

  async confirmDelete(item: MstMembership): Promise<void> {
    const ok = await this.confirmDialog.confirmDelete(`เมมเบอร์ "${item.name}"`);
    if (!ok) return;
    this.shopMaster.deleteMembership(item.id).subscribe({
      next: () => {
        this.toast.showSuccess('ลบเมมเบอร์เรียบร้อย');
        this.loadItems();
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถลบเมมเบอร์ได้');
      },
    });
  }

  sanitizeIntegerInput(
    form: 'create' | 'edit',
    controlName: 'packagePrice' | 'quantity' | 'freeDrinks',
    event: Event,
  ): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/\D+/g, '');
    const targetForm = form === 'create' ? this.createForm : this.editForm;
    targetForm.controls[controlName].setValue(sanitized, { emitEvent: false });
  }
}
