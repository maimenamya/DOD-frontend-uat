import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { AppModalComponent } from '../../components/app-modal/app-modal.component';
import { DEFAULT_DRINK_PRICE } from '../../constants/drink';
import type { ResourceItem } from '../../models/resource';
import { AuthService } from '../../services/auth.service';
import { ResourceService } from '../../services/resource.service';

@Component({
  selector: 'app-master-drink-page',
  imports: [DecimalPipe, ReactiveFormsModule, AppModalComponent],
  templateUrl: './master-drink-page.component.html',
})
export class MasterDrinkPageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly resourceService = inject(ResourceService);
  private readonly auth = inject(AuthService);

  readonly canManage = computed(() => this.auth.canAccessTeamManagement());
  readonly drinks = signal<ResourceItem[]>([]);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly editingDrink = signal<ResourceItem | null>(null);
  readonly showCreateModal = signal(false);

  readonly createForm = this.fb.group({
    name: ['', Validators.required],
    price: [DEFAULT_DRINK_PRICE, [Validators.required, Validators.min(0)]],
  });

  readonly editForm = this.fb.group({
    name: ['', Validators.required],
    price: [DEFAULT_DRINK_PRICE, [Validators.required, Validators.min(0)]],
  });

  ngOnInit(): void {
    this.loadDrinks();
  }

  loadDrinks(): void {
    this.loading.set(true);
    this.error.set(null);
    this.resourceService.getResources().subscribe({
      next: (items) => {
        this.drinks.set(items);
        this.loading.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.error.set(err.error?.error ?? 'ไม่สามารถโหลดข้อมูลเครื่องดื่มได้');
        this.loading.set(false);
      },
    });
  }

  openCreate(): void {
    this.success.set(null);
    this.error.set(null);
    this.createForm.reset({ name: '', price: DEFAULT_DRINK_PRICE });
    this.showCreateModal.set(true);
  }

  closeCreate(): void {
    this.showCreateModal.set(false);
  }

  openEdit(item: ResourceItem): void {
    this.success.set(null);
    this.error.set(null);
    this.editForm.reset({ name: item.name, price: item.price });
    this.editingDrink.set(item);
  }

  closeEdit(): void {
    this.editingDrink.set(null);
  }

  submitCreate(): void {
    if (this.createForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);
    const { name, price } = this.createForm.getRawValue();
    this.resourceService.createResource({ name, price }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.success.set('เพิ่มเครื่องดื่มเรียบร้อย');
        this.closeCreate();
        this.loadDrinks();
      },
      error: (err: { error?: { error?: string } }) => {
        this.submitting.set(false);
        this.error.set(err.error?.error ?? 'ไม่สามารถเพิ่มเครื่องดื่มได้');
      },
    });
  }

  submitEdit(): void {
    const item = this.editingDrink();
    if (!item || this.editForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);
    const { name, price } = this.editForm.getRawValue();
    this.resourceService.updateResource(item.id, { name, price }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.success.set('บันทึกการแก้ไขเรียบร้อย');
        this.closeEdit();
        this.loadDrinks();
      },
      error: (err: { error?: { error?: string } }) => {
        this.submitting.set(false);
        this.error.set(err.error?.error ?? 'ไม่สามารถแก้ไขเครื่องดื่มได้');
      },
    });
  }

  confirmDelete(item: ResourceItem): void {
    if (!confirm(`ลบเครื่องดื่ม "${item.name}" ใช่หรือไม่?`)) return;
    this.error.set(null);
    this.resourceService.deleteResource(item.id).subscribe({
      next: () => {
        this.success.set('ลบเครื่องดื่มเรียบร้อย');
        this.loadDrinks();
      },
      error: (err: { error?: { error?: string } }) => {
        this.error.set(err.error?.error ?? 'ไม่สามารถลบเครื่องดื่มได้');
      },
    });
  }
}
