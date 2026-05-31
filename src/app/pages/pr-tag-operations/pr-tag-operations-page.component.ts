import { Component, OnInit, computed, inject, signal } from '@angular/core';
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
import type { PrTagAssignableEmployee, PrTagOperationsRow } from '../../models/pr-tag';
import { AuthService } from '../../services/auth.service';
import { PrTagService } from '../../services/pr-tag.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';
import { roleOptionLabel } from '../../utils/role-display.util';

@Component({
  selector: 'app-pr-tag-operations-page',
  imports: [ReactiveFormsModule, AppModalComponent, CustomDropdownComponent],
  templateUrl: './pr-tag-operations-page.component.html',
})
export class PrTagOperationsPageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly prTagService = inject(PrTagService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly canManage = computed(() => this.auth.canAccessTeamManagement());
  readonly rows = signal<PrTagOperationsRow[]>([]);
  readonly assignableEmployees = signal<PrTagAssignableEmployee[]>([]);
  readonly tagOptions = signal<DropdownOption[]>([]);
  readonly loading = signal(true);
  readonly acting = signal(false);
  readonly showAssignModal = signal(false);

  readonly assignForm = this.fb.group({
    employeeId: ['', Validators.required],
    prTagId: ['', Validators.required],
  });

  readonly employeeOptions = computed<DropdownOption[]>(() =>
    this.assignableEmployees().map((r) => ({
      value: r.employeeId,
      label: `${r.nickname} — ${roleOptionLabel({
        name: r.roleName,
        displayNameTh: r.roleDisplayNameTh,
      })}`,
    })),
  );

  readonly tagDropdownOptions = computed(() => this.tagOptions());

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.loading.set(true);
    this.prTagService.getOperationsDashboard().subscribe({
      next: (data) => {
        this.rows.set(data.rows);
        this.assignableEmployees.set(data.assignableEmployees);
        this.tagOptions.set(
          data.activeTags.map((t) => ({
            value: String(t.id),
            label: `${t.name} (${t.requiredWorkingDays} วัน / ${t.targetDrinks} ดื่ม)`,
          })),
        );
        this.loading.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถโหลดรายการแท็กได้');
        this.loading.set(false);
      },
    });
  }

  openAssignModal(): void {
    if (this.assignableEmployees().length === 0) {
      this.toast.showError('ไม่มี PR ที่ว่างสำหรับตั้งแท็ก (ทุกคนมีแท็กอยู่แล้ว)');
      return;
    }
    this.assignForm.reset({ employeeId: '', prTagId: '' });
    this.showAssignModal.set(true);
  }

  closeAssignModal(): void {
    this.showAssignModal.set(false);
  }

  submitAssign(): void {
    if (this.assignForm.invalid) {
      this.toast.showError('กรุณาเลือก PR และแพ็กเกจแท็ก');
      return;
    }
    const raw = this.assignForm.getRawValue();
    const employeeId = raw.employeeId.trim();
    const prTagId = Number.parseInt(raw.prTagId, 10);
    if (this.acting()) return;
    this.acting.set(true);
    this.prTagService.assignTag(employeeId, prTagId).subscribe({
      next: () => {
        this.acting.set(false);
        this.closeAssignModal();
        this.toast.showSuccess('ตั้งแท็กเรียบร้อย');
        this.loadDashboard();
      },
      error: (err: { error?: { error?: string } }) => {
        this.acting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถตั้งแท็กได้');
      },
    });
  }

  checkIn(row: PrTagOperationsRow): void {
    const id = row.enrollment?.id;
    if (!id || !row.enrollment?.canCheckIn || this.acting()) return;
    this.acting.set(true);
    this.prTagService.checkIn(id).subscribe({
      next: (updated) => {
        this.acting.set(false);
        this.toast.showSuccess('บันทึกวันทำงาน (+1 วัน)');
        if (updated.enrollment?.status === 'COMPLETED') {
          this.toast.showSuccess('ครบวันทำงาน — ปิดแท็กสำเร็จ');
          this.loadDashboard();
          return;
        }
        this.patchRow(updated);
      },
      error: (err: { error?: { error?: string } }) => {
        this.acting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถบันทึกวันทำงานได้');
      },
    });
  }

  recordOffDay(row: PrTagOperationsRow): void {
    const id = row.enrollment?.id;
    if (!id || !row.enrollment?.canRecordOffDay || this.acting()) return;
    this.acting.set(true);
    this.prTagService.recordOffDay(id).subscribe({
      next: (updated) => {
        this.acting.set(false);
        this.toast.showSuccess('บันทึกวันหยุดแล้ว');
        if (updated.enrollment?.status !== 'ACTIVE') {
          this.loadDashboard();
          return;
        }
        this.patchRow(updated);
      },
      error: (err: { error?: { error?: string } }) => {
        this.acting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถบันทึกวันหยุดได้');
      },
    });
  }

  async forceCut(row: PrTagOperationsRow): Promise<void> {
    const id = row.enrollment?.id;
    if (!id || !row.enrollment?.canForceCut) return;
    const ok = await this.confirmDialog.confirm({
      title: 'ตัดแท็กทันที',
      message: `ยืนยันตัดแท็กของ ${row.nickname} และปรับเป็น Freelance?`,
      confirmLabel: 'ตัดแท็ก',
    });
    if (!ok || this.acting()) return;
    this.acting.set(true);
    this.prTagService.forceCut(id).subscribe({
      next: () => {
        this.acting.set(false);
        this.toast.showSuccess('ตัดแท็กเรียบร้อย');
        this.loadDashboard();
      },
      error: (err: { error?: { error?: string } }) => {
        this.acting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถตัดแท็กได้');
      },
    });
  }

  private patchRow(updated: PrTagOperationsRow): void {
    this.rows.update((list) =>
      list.map((r) => (r.employeeId === updated.employeeId ? updated : r)),
    );
  }
}
