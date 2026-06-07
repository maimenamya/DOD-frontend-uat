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
  styleUrl: './pr-tag-operations-page.component.css',
})
export class PrTagOperationsPageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly prTagService = inject(PrTagService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  /** ลงแท็ก / เข้างาน / วันหยุด / ตัดแท็ก — ไม่ใช่สิทธิ์จัดการพนักงาน (CASHIER ใช้ได้) */
  readonly canOperateTags = computed(() => this.auth.canWriteOnPage('pr_tag_operations'));
  readonly rows = signal<PrTagOperationsRow[]>([]);
  readonly assignableEmployees = signal<PrTagAssignableEmployee[]>([]);
  readonly tagOptions = signal<DropdownOption[]>([]);
  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly acting = signal(false);
  readonly showAssignModal = signal(false);
  readonly showChangeTagModal = signal(false);
  readonly showForceCutModal = signal(false);
  readonly changeTagTarget = signal<PrTagOperationsRow | null>(null);
  readonly forceCutTarget = signal<PrTagOperationsRow | null>(null);

  readonly assignForm = this.fb.group({
    employeeId: ['', Validators.required],
    prTagId: ['', Validators.required],
  });

  readonly changeTagForm = this.fb.group({
    prTagId: ['', Validators.required],
  });

  readonly forceCutForm = this.fb.group({
    endNote: ['', Validators.maxLength(500)],
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

  readonly changeTagDropdownOptions = computed<DropdownOption[]>(() => {
    const currentId = this.changeTagTarget()?.enrollment?.tagId;
    return this.tagOptions().filter((o) => o.value !== String(currentId));
  });

  /** ต้องมีแพ็กเกจมากกว่า 1 แบบถึงจะเปลี่ยนได้ (เคส 2 — แคชเชียร์เปลี่ยนให้ PR) */
  readonly hasMultipleTagPackages = computed(() => this.tagOptions().length > 1);

  canChangeTagPackage(row: PrTagOperationsRow): boolean {
    const e = row.enrollment;
    return Boolean(e?.canChangeTag && this.hasMultipleTagPackages());
  }

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
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
      error: (err: { status?: number; error?: { error?: string } }) => {
        this.rows.set([]);
        this.assignableEmployees.set([]);
        this.tagOptions.set([]);
        this.loadFailed.set(true);
        const msg =
          err.status === 401
            ? 'เซสชันหมดอายุ — กรุณาเข้าสู่ระบบใหม่'
            : (err.error?.error ?? 'ไม่สามารถโหลดรายการแท็กได้');
        this.toast.showError(msg);
        this.loading.set(false);
      },
    });
  }

  openAssignModal(): void {
    if (this.loadFailed()) {
      this.toast.showError('โหลดข้อมูลไม่สำเร็จ — ลองรีเฟรชหน้าหรือเข้าสู่ระบบใหม่');
      return;
    }
    if (this.tagOptions().length === 0) {
      this.toast.showError('ยังไม่มีแพ็กเกจแท็ก — ตั้งค่าที่เมนู แพ็กเกจแท็ก PR ก่อน');
      return;
    }
    if (this.assignableEmployees().length === 0) {
      this.toast.showError('ไม่มี PR ที่ว่างสำหรับลงแท็ก (ทุกคนมีแท็กอยู่แล้ว)');
      return;
    }
    this.assignForm.reset({ employeeId: '', prTagId: '' });
    this.showAssignModal.set(true);
  }

  closeAssignModal(): void {
    this.showAssignModal.set(false);
  }

  openChangeTagModal(row: PrTagOperationsRow): void {
    if (!this.canChangeTagPackage(row)) {
      if (!this.hasMultipleTagPackages()) {
        this.toast.showError('ไม่มีแพ็กเกจแท็กอื่นให้เปลี่ยน — เพิ่มที่เมนู แพ็กเกจแท็ก PR');
      }
      return;
    }
    const enrollment = row.enrollment;
    if (!enrollment) return;
    const alternatives = this.tagOptions().filter(
      (o) => o.value !== String(enrollment.tagId),
    );
    if (alternatives.length === 0) {
      this.toast.showError('ไม่มีแพ็กเกจแท็กอื่นให้เปลี่ยน — เพิ่มที่เมนู แพ็กเกจแท็ก PR');
      return;
    }
    this.changeTagTarget.set(row);
    this.changeTagForm.reset({ prTagId: '' });
    this.showChangeTagModal.set(true);
  }

  closeChangeTagModal(): void {
    this.showChangeTagModal.set(false);
    this.changeTagTarget.set(null);
  }

  submitChangeTag(): void {
    const row = this.changeTagTarget();
    const enrollmentId = row?.enrollment?.id;
    if (!enrollmentId || this.changeTagForm.invalid) {
      this.toast.showError('กรุณาเลือกแพ็กเกจแท็กใหม่');
      return;
    }
    const prTagId = Number.parseInt(this.changeTagForm.getRawValue().prTagId, 10);
    if (!Number.isFinite(prTagId)) return;
    if (this.acting()) return;
    this.acting.set(true);
    this.prTagService.changeEnrollmentTag(enrollmentId, prTagId).subscribe({
      next: (updated) => {
        this.acting.set(false);
        this.closeChangeTagModal();
        this.toast.showSuccess('เปลี่ยนแพ็กเกจแท็กแล้ว (คงวันทำงาน วันหยุด และดื่มสะสม)');
        this.loadDashboard();
      },
      error: (err: { error?: { error?: string } }) => {
        this.acting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถเปลี่ยนแท็กได้');
      },
    });
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
        this.toast.showSuccess('ลงแท็กเรียบร้อย');
        this.loadDashboard();
      },
      error: (err: { error?: { error?: string } }) => {
        this.acting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถลงแท็กได้');
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
        this.patchRow(updated);
      },
      error: (err: { error?: { error?: string } }) => {
        this.acting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถบันทึกวันหยุดได้');
      },
    });
  }

  async completeTag(row: PrTagOperationsRow): Promise<void> {
    const id = row.enrollment?.id;
    if (!id || !row.enrollment?.canCompleteTag) return;
    const ok = await this.confirmDialog.confirm({
      title: 'จบแท็ก',
      message: `ยืนยันจบแท็กของ ${row.nickname} (ครบวันทำงานและยอดดื่มแล้ว)?`,
      confirmLabel: 'จบแท็ก',
    });
    if (!ok || this.acting()) return;
    this.acting.set(true);
    this.prTagService.completeTag(id).subscribe({
      next: () => {
        this.acting.set(false);
        this.toast.showSuccess('จบแท็กสำเร็จ');
        this.loadDashboard();
      },
      error: (err: { error?: { error?: string } }) => {
        this.acting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถจบแท็กได้');
      },
    });
  }

  openForceCutModal(row: PrTagOperationsRow): void {
    if (!row.enrollment?.canForceCut) return;
    this.forceCutTarget.set(row);
    this.forceCutForm.reset({ endNote: '' });
    this.showForceCutModal.set(true);
  }

  closeForceCutModal(): void {
    this.showForceCutModal.set(false);
    this.forceCutTarget.set(null);
  }

  submitForceCut(): void {
    const row = this.forceCutTarget();
    const id = row?.enrollment?.id;
    if (!id || this.acting()) return;

    const endNote = this.forceCutForm.getRawValue().endNote.trim();
    this.acting.set(true);
    this.prTagService.forceCut(id, endNote || undefined).subscribe({
      next: () => {
        this.acting.set(false);
        this.closeForceCutModal();
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
