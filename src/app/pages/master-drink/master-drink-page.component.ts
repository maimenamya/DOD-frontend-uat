import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { AppModalComponent } from '../../components/app-modal/app-modal.component';
import type { Beverage } from '../../models/beverage';
import { AuthService } from '../../services/auth.service';
import { BeverageService } from '../../services/beverage.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-master-drink-page',
  imports: [DecimalPipe, ReactiveFormsModule, AppModalComponent],
  templateUrl: './master-drink-page.component.html',
})
export class MasterDrinkPageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly beverageService = inject(BeverageService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly canManage = computed(() => this.auth.canAccessTeamManagement());
  readonly beverages = signal<Beverage[]>([]);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly editingBeverage = signal<Beverage | null>(null);
  readonly showCreateModal = signal(false);

  readonly createForm = this.fb.group({
    name: ['', Validators.required],
    price: [0, [Validators.required, Validators.min(0)]],
  });

  readonly editForm = this.fb.group({
    name: ['', Validators.required],
    price: [0, [Validators.required, Validators.min(0)]],
  });

  ngOnInit(): void {
    this.loadBeverages();
  }

  loadBeverages(): void {
    this.loading.set(true);
    this.showCreateModal.set(false);
    this.beverageService.getBeverages().subscribe({
      next: (items) => {
        this.beverages.set(items);
        this.loading.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถโหลดข้อมูลเครื่องดื่มได้');
        this.loading.set(false);
      },
    });
  }

  openCreate(): void {
    if (this.loading()) return;
    this.createForm.reset({ name: '', price: 0 });
    this.showCreateModal.set(true);
  }

  closeCreate(): void {
    this.showCreateModal.set(false);
  }

  openEdit(item: Beverage): void {
    this.editForm.reset({ name: item.name, price: item.price });
    this.editingBeverage.set(item);
  }

  closeEdit(): void {
    this.editingBeverage.set(null);
  }

  submitCreate(): void {
    if (this.createForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    const { name, price } = this.createForm.getRawValue();
    this.beverageService.createBeverage({ name, price }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeCreate();
        this.toast.showSuccess('เพิ่มเครื่องดื่มเรียบร้อย');
        this.loadBeverages();
      },
      error: (err: { error?: { error?: string } }) => {
        this.submitting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถเพิ่มเครื่องดื่มได้');
      },
    });
  }

  submitEdit(): void {
    const item = this.editingBeverage();
    if (!item || this.editForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    const { name, price } = this.editForm.getRawValue();
    this.beverageService.updateBeverage(item.id, { name, price }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeEdit();
        this.toast.showSuccess('บันทึกการแก้ไขเรียบร้อย');
        this.loadBeverages();
      },
      error: (err: { error?: { error?: string } }) => {
        this.submitting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถแก้ไขเครื่องดื่มได้');
      },
    });
  }

  confirmDelete(item: Beverage): void {
    if (!confirm(`ลบเครื่องดื่ม "${item.name}" ใช่หรือไม่?`)) return;
    this.beverageService.deleteBeverage(item.id).subscribe({
      next: () => {
        this.toast.showSuccess('ลบเครื่องดื่มเรียบร้อย');
        this.loadBeverages();
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถลบเครื่องดื่มได้');
      },
    });
  }
}
