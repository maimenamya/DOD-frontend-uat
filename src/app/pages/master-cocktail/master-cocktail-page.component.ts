import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { AppModalComponent } from '../../components/app-modal/app-modal.component';
import type { MstCocktail } from '../../models/master-data';
import { AuthService } from '../../services/auth.service';
import { ShopMasterService } from '../../services/shop-master.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-master-cocktail-page',
  imports: [DecimalPipe, ReactiveFormsModule, AppModalComponent],
  templateUrl: './master-cocktail-page.component.html',
})
export class MasterCocktailPageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly shopMaster = inject(ShopMasterService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly canManage = computed(() => this.auth.canAccessTeamManagement());
  readonly cocktails = signal<MstCocktail[]>([]);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly editingItem = signal<MstCocktail | null>(null);
  readonly showCreateModal = signal(false);

  readonly createForm = this.fb.group({
    name: ['', Validators.required],
    drinkValue: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
  });

  readonly editForm = this.fb.group({
    name: ['', Validators.required],
    drinkValue: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
  });

  ngOnInit(): void {
    this.loadItems();
  }

  loadItems(): void {
    this.loading.set(true);
    this.showCreateModal.set(false);
    this.shopMaster.getCocktails().subscribe({
      next: (items) => {
        this.cocktails.set(items);
        this.loading.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถโหลดข้อมูลค็อกเทลได้');
        this.loading.set(false);
      },
    });
  }

  openCreate(): void {
    if (this.loading()) return;
    this.createForm.reset({ name: '', drinkValue: '' });
    this.showCreateModal.set(true);
  }

  closeCreate(): void {
    this.showCreateModal.set(false);
  }

  openEdit(item: MstCocktail): void {
    this.editForm.reset({ name: item.name, drinkValue: String(item.drinkValue) });
    this.editingItem.set(item);
  }

  closeEdit(): void {
    this.editingItem.set(null);
  }

  submitCreate(): void {
    if (this.createForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    const { name, drinkValue } = this.createForm.getRawValue();
    this.shopMaster.createCocktail({ name, drinkValue: Number.parseInt(drinkValue, 10) }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeCreate();
        this.toast.showSuccess('เพิ่มค็อกเทลเรียบร้อย');
        this.loadItems();
      },
      error: (err: { error?: { error?: string } }) => {
        this.submitting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถเพิ่มค็อกเทลได้');
      },
    });
  }

  submitEdit(): void {
    const item = this.editingItem();
    if (!item || this.editForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    const { name, drinkValue } = this.editForm.getRawValue();
    this.shopMaster
      .updateCocktail(item.id, { name, drinkValue: Number.parseInt(drinkValue, 10) })
      .subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeEdit();
        this.toast.showSuccess('บันทึกการแก้ไขเรียบร้อย');
        this.loadItems();
      },
      error: (err: { error?: { error?: string } }) => {
        this.submitting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถแก้ไขค็อกเทลได้');
      },
    });
  }

  async confirmDelete(item: MstCocktail): Promise<void> {
    const ok = await this.confirmDialog.confirmDelete(`ค็อกเทล "${item.name}"`);
    if (!ok) return;
    this.shopMaster.deleteCocktail(item.id).subscribe({
      next: () => {
        this.toast.showSuccess('ลบค็อกเทลเรียบร้อย');
        this.loadItems();
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถลบค็อกเทลได้');
      },
    });
  }

  sanitizeIntegerInput(form: 'create' | 'edit', controlName: 'drinkValue', event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/\D+/g, '');
    const targetForm = form === 'create' ? this.createForm : this.editForm;
    targetForm.controls[controlName].setValue(sanitized, { emitEvent: false });
  }
}
