import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { AppModalComponent } from '../../components/app-modal/app-modal.component';
import type { MstSeating, MstSeatingType } from '../../models/seating';
import { AuthService } from '../../services/auth.service';
import { ShopMasterService } from '../../services/shop-master.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-master-seating-list-page',
  imports: [ReactiveFormsModule, AppModalComponent, RouterLink],
  templateUrl: './master-seating-list-page.component.html',
})
export class MasterSeatingListPageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly shopMaster = inject(ShopMasterService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly canManage = computed(() => this.auth.canWriteOnPage('master_data'));
  readonly seatings = signal<MstSeating[]>([]);
  readonly seatingTypes = signal<MstSeatingType[]>([]);
  readonly selectedSeatingTypeId = signal<number | null>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly editingItem = signal<MstSeating | null>(null);
  readonly showCreateModal = signal(false);

  readonly filteredSeatings = computed(() => {
    const typeId = this.selectedSeatingTypeId();
    if (typeId == null) return [];
    return this.seatings().filter((s) => s.seatingTypeId === typeId);
  });

  readonly selectedSeatingType = computed(() =>
    this.seatingTypes().find((t) => t.id === this.selectedSeatingTypeId()) ?? null,
  );

  readonly createForm = this.fb.group({
    code: ['', Validators.required],
    chargesRoomFee: [false],
  });

  readonly editForm = this.fb.group({
    code: ['', Validators.required],
    chargesRoomFee: [false],
  });

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.loading.set(true);
    this.showCreateModal.set(false);
    forkJoin({
      types: this.shopMaster.getSeatingTypes(),
      seatings: this.shopMaster.getSeatings(),
    }).subscribe({
      next: ({ types, seatings }) => {
        this.seatingTypes.set(types);
        this.seatings.set(seatings);
        this.syncSelectedSeatingType(types);
        this.loading.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถโหลดรายชื่อที่นั่งได้');
        this.seatingTypes.set([]);
        this.seatings.set([]);
        this.loading.set(false);
      },
    });
  }

  private syncSelectedSeatingType(types: MstSeatingType[]): void {
    if (types.length === 0) {
      this.selectedSeatingTypeId.set(null);
      return;
    }
    const current = this.selectedSeatingTypeId();
    const stillValid = current != null && types.some((t) => t.id === current);
    const nextId = stillValid ? current! : types[0].id;
    this.selectSeatingType(nextId);
  }

  selectSeatingType(typeId: number): void {
    this.selectedSeatingTypeId.set(typeId);
    this.showCreateModal.set(false);
    this.editingItem.set(null);
  }

  seatingTypeName(item: MstSeating): string {
    return item.seatingType?.name ?? '—';
  }

  statusLabel(status: string): string {
    if (status === 'OCCUPIED') return 'มีลูกค้า';
    if (status === 'AWAITING_CLEAR') return 'รอเคลียโต๊ะ';
    return 'ว่าง';
  }

  billingModeLabel(chargesRoomFee: boolean): string {
    return chargesRoomFee ? 'คิดค่าบริการ' : 'ไม่คิดค่าบริการ';
  }

  openCreate(): void {
    if (this.loading() || this.selectedSeatingTypeId() == null) return;
    this.createForm.reset({ code: '', chargesRoomFee: false });
    this.showCreateModal.set(true);
  }

  closeCreate(): void {
    this.showCreateModal.set(false);
  }

  openEdit(item: MstSeating): void {
    this.editForm.reset({ code: item.code, chargesRoomFee: item.chargesRoomFee });
    this.editingItem.set(item);
  }

  closeEdit(): void {
    this.editingItem.set(null);
  }

  submitCreate(): void {
    if (this.createForm.invalid || this.submitting()) return;
    const seatingTypeId = this.selectedSeatingTypeId();
    if (seatingTypeId == null) {
      this.toast.showError('กรุณาเลือกประเภทที่นั่ง');
      return;
    }
    const { code, chargesRoomFee } = this.createForm.getRawValue();
    this.submitting.set(true);
    this.shopMaster.createSeating({ code, seatingTypeId, chargesRoomFee }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeCreate();
        this.toast.showSuccess('เพิ่มที่นั่งเรียบร้อย');
        this.loadAll();
      },
      error: (err: { error?: { error?: string } }) => {
        this.submitting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถเพิ่มที่นั่งได้');
      },
    });
  }

  submitEdit(): void {
    const item = this.editingItem();
    if (!item || this.editForm.invalid || this.submitting()) return;
    const { code, chargesRoomFee } = this.editForm.getRawValue();
    this.submitting.set(true);
    this.shopMaster
      .updateSeating(item.id, { code, seatingTypeId: item.seatingTypeId, chargesRoomFee })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.closeEdit();
          this.toast.showSuccess('บันทึกการแก้ไขเรียบร้อย');
          this.loadAll();
        },
        error: (err: { error?: { error?: string } }) => {
          this.submitting.set(false);
          this.toast.showError(err.error?.error ?? 'ไม่สามารถแก้ไขที่นั่งได้');
        },
      });
  }

  async confirmDelete(item: MstSeating): Promise<void> {
    const ok = await this.confirmDialog.confirmDelete(`ที่นั่ง "${item.code}"`);
    if (!ok) return;
    this.shopMaster.deleteSeating(item.id).subscribe({
      next: () => {
        this.toast.showSuccess('ลบที่นั่งเรียบร้อย');
        this.loadAll();
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถลบที่นั่งได้');
      },
    });
  }
}
