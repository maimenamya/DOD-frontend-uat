import { Component, OnInit, computed, inject, signal } from '@angular/core';
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
import type { Room, RoomPricingType } from '../../models/master-data';
import { AuthService } from '../../services/auth.service';
import { ShopMasterService } from '../../services/shop-master.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';

const PRICING_TYPE_OPTIONS: DropdownOption[] = [
  { value: 'HOURLY', label: 'ต่อชั่วโมง' },
  { value: 'FLAT_RATE', label: 'ตลอดทั้งคืน' },
];

@Component({
  selector: 'app-master-room-page',
  imports: [DecimalPipe, ReactiveFormsModule, AppModalComponent, CustomDropdownComponent],
  templateUrl: './master-room-page.component.html',
})
export class MasterRoomPageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly shopMaster = inject(ShopMasterService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly pricingTypeOptions = PRICING_TYPE_OPTIONS;

  readonly canManage = computed(() => this.auth.canAccessTeamManagement());
  readonly rooms = signal<Room[]>([]);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly editingItem = signal<Room | null>(null);
  readonly showCreateModal = signal(false);

  readonly createForm = this.fb.group({
    roomCode: ['', Validators.required],
    price: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    pricingType: ['HOURLY' as RoomPricingType, Validators.required],
  });

  readonly editForm = this.fb.group({
    roomCode: ['', Validators.required],
    price: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    pricingType: ['HOURLY' as RoomPricingType, Validators.required],
  });

  ngOnInit(): void {
    this.loadItems();
  }

  loadItems(): void {
    this.loading.set(true);
    this.showCreateModal.set(false);
    this.shopMaster.getRooms().subscribe({
      next: (items) => {
        this.rooms.set(items);
        this.loading.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถโหลดข้อมูลห้องได้');
        this.loading.set(false);
      },
    });
  }

  pricingTypeLabel(type: RoomPricingType): string {
    return type === 'HOURLY' ? 'ต่อชั่วโมง' : 'ตลอดทั้งคืน';
  }

  openCreate(): void {
    if (this.loading()) return;
    this.createForm.reset({ roomCode: '', price: '', pricingType: 'HOURLY' });
    this.showCreateModal.set(true);
  }

  closeCreate(): void {
    this.showCreateModal.set(false);
  }

  openEdit(item: Room): void {
    this.editForm.reset({
      roomCode: item.roomCode,
      price: String(item.price),
      pricingType: item.pricingType,
    });
    this.editingItem.set(item);
  }

  closeEdit(): void {
    this.editingItem.set(null);
  }

  submitCreate(): void {
    if (this.createForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    const { roomCode, price, pricingType } = this.createForm.getRawValue();
    this.shopMaster
      .createRoom({ roomCode, price: Number.parseInt(price, 10), pricingType })
      .subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeCreate();
        this.toast.showSuccess('เพิ่มห้องเรียบร้อย');
        this.loadItems();
      },
      error: (err: { error?: { error?: string } }) => {
        this.submitting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถเพิ่มห้องได้');
      },
    });
  }

  submitEdit(): void {
    const item = this.editingItem();
    if (!item || this.editForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    const { roomCode, price, pricingType } = this.editForm.getRawValue();
    this.shopMaster
      .updateRoom(item.id, { roomCode, price: Number.parseInt(price, 10), pricingType })
      .subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeEdit();
        this.toast.showSuccess('บันทึกการแก้ไขเรียบร้อย');
        this.loadItems();
      },
      error: (err: { error?: { error?: string } }) => {
        this.submitting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถแก้ไขห้องได้');
      },
    });
  }

  async confirmDelete(item: Room): Promise<void> {
    const ok = await this.confirmDialog.confirmDelete(`ห้อง "${item.roomCode}"`);
    if (!ok) return;
    this.shopMaster.deleteRoom(item.id).subscribe({
      next: () => {
        this.toast.showSuccess('ลบห้องเรียบร้อย');
        this.loadItems();
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถลบห้องได้');
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
