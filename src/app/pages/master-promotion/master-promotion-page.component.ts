import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  highlightInvalidForm,
  resetFormValidationFlag,
} from '../../utils/form-validation.util';
import { DecimalPipe } from '@angular/common';
import {
  FormArray,
  NonNullableFormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { forkJoin } from 'rxjs';

import { AppModalComponent } from '../../components/app-modal/app-modal.component';
import { DrinkPackageLinesEditorComponent } from '../../components/drink-package-lines-editor/drink-package-lines-editor.component';
import { ListPaginatorComponent } from '../../components/list-paginator/list-paginator.component';
import { MasterListToolbarComponent } from '../../components/master-list-toolbar/master-list-toolbar.component';
import type { MstBeverage, MstBeverageCategory } from '../../models/beverage';
import type { MstPromotion } from '../../models/master-data';
import { AuthService } from '../../services/auth.service';
import { BeverageService } from '../../services/beverage.service';
import { ShopMasterService } from '../../services/shop-master.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';
import {
  createDrinkPackageLineForm,
  drinkPackageItemsFromForm,
  seedDrinkPackageLineForms,
  type DrinkPackageLineForm,
} from '../../utils/drink-package-form.util';
import {
  drinkPackageItemsSearchText,
  drinkPackageItemsSummary,
} from '../../utils/drink-package.util';
import {
  MasterListQueryState,
  createMasterListView,
  masterListRowNumber,
} from '../../utils/master-list.util';

@Component({
  selector: 'app-master-promotion-page',
  imports: [
    DecimalPipe,
    FormsModule,
    ReactiveFormsModule,
    AppModalComponent,
    DrinkPackageLinesEditorComponent,
    MasterListToolbarComponent,
    ListPaginatorComponent,
  ],
  templateUrl: './master-promotion-page.component.html',
})
export class MasterPromotionPageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly shopMaster = inject(ShopMasterService);
  private readonly beverageService = inject(BeverageService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly canManage = computed(() => this.auth.canWriteOnPage('master_data'));
  readonly promotions = signal<MstPromotion[]>([]);
  readonly listQuery = new MasterListQueryState();
  readonly listView = createMasterListView(this.promotions, this.listQuery, (item) =>
    `${item.name} ${drinkPackageItemsSearchText(item.items)}`,
  );
  readonly masterListRowNumber = masterListRowNumber;
  readonly beverages = signal<MstBeverage[]>([]);
  readonly beverageCategories = signal<MstBeverageCategory[]>([]);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly createFormValidated = signal(false);
  readonly editFormValidated = signal(false);
  readonly editingItem = signal<MstPromotion | null>(null);
  readonly showCreateModal = signal(false);

  readonly createForm = this.fb.group({
    name: ['', Validators.required],
    packagePrice: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    items: this.fb.array<DrinkPackageLineForm>([]),
    isFreeMixer: [false],
    allowDeposit: [false],
    freeDrinks: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
  });

  readonly editForm = this.fb.group({
    name: ['', Validators.required],
    packagePrice: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    items: this.fb.array<DrinkPackageLineForm>([]),
    isFreeMixer: [false],
    allowDeposit: [false],
    freeDrinks: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
  });

  get createItems(): FormArray<DrinkPackageLineForm> {
    return this.createForm.controls.items;
  }

  get editItems(): FormArray<DrinkPackageLineForm> {
    return this.editForm.controls.items;
  }

  ngOnInit(): void {
    this.loadItems();
  }

  loadItems(): void {
    this.loading.set(true);
    this.showCreateModal.set(false);
    forkJoin({
      promotions: this.shopMaster.getPromotions(),
      beverages: this.beverageService.getBeverages(),
      beverageCategories: this.shopMaster.getBeverageCategories(),
    }).subscribe({
      next: ({ promotions, beverages, beverageCategories }) => {
        this.promotions.set(promotions);
        this.beverages.set(beverages);
        this.beverageCategories.set(beverageCategories);
        this.loading.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถโหลดข้อมูลโปรโมชั่นได้');
        this.loading.set(false);
      },
    });
  }

  itemsSummary(item: MstPromotion): string {
    return drinkPackageItemsSummary(item.items);
  }

  freeMixerLabel(value: boolean): string {
    return value ? 'ใช่' : 'ไม่';
  }

  allowDepositLabel(value: boolean): string {
    return value ? 'ได้' : 'ไม่ได้';
  }

  openCreate(): void {
    resetFormValidationFlag(this.createFormValidated);
    if (this.loading()) return;
    this.resetItemLines(
      this.createItems,
      seedDrinkPackageLineForms(
        this.fb,
        this.beverages(),
        this.beverageCategories(),
        [],
      ),
    );
    this.createForm.reset({
      name: '',
      packagePrice: '',
      isFreeMixer: false,
      allowDeposit: false,
      freeDrinks: '',
    });
    this.showCreateModal.set(true);
  }

  closeCreate(): void {
    this.showCreateModal.set(false);
  }

  openEdit(item: MstPromotion): void {
    resetFormValidationFlag(this.editFormValidated);
    this.resetItemLines(
      this.editItems,
      seedDrinkPackageLineForms(this.fb, this.beverages(), this.beverageCategories(), item.items),
    );
    this.editForm.reset({
      name: item.name,
      packagePrice: String(item.packagePrice),
      isFreeMixer: item.isFreeMixer,
      allowDeposit: item.allowDeposit ?? false,
      freeDrinks: String(item.freeDrinks ?? 0),
    });
    this.editingItem.set(item);
  }

  closeEdit(): void {
    this.editingItem.set(null);
  }

  addCreateLine(): void {
    this.createItems.push(
      createDrinkPackageLineForm(this.fb, this.beverages(), this.beverageCategories()),
    );
  }

  addEditLine(): void {
    this.editItems.push(
      createDrinkPackageLineForm(this.fb, this.beverages(), this.beverageCategories()),
    );
  }

  submitCreate(): void {
    if (this.submitting()) return;
    if (highlightInvalidForm(this.createForm, this.createFormValidated, this.toast)) return;
    this.submitting.set(true);
    const raw = this.createForm.getRawValue();
    const payload = {
      name: raw.name,
      packagePrice: Number.parseInt(raw.packagePrice, 10),
      items: drinkPackageItemsFromForm(this.createItems.controls),
      isFreeMixer: raw.isFreeMixer,
      allowDeposit: raw.allowDeposit,
      freeDrinks: Number.parseInt(raw.freeDrinks, 10),
    };
    this.shopMaster.createPromotion(payload).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeCreate();
        this.toast.showSuccess('เพิ่มโปรโมชั่นเรียบร้อย');
        this.loadItems();
      },
      error: (err: { error?: { error?: string } }) => {
        this.submitting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถเพิ่มโปรโมชั่นได้');
      },
    });
  }

  submitEdit(): void {
    const item = this.editingItem();
    if (!item || this.submitting()) return;
    if (highlightInvalidForm(this.editForm, this.editFormValidated, this.toast)) return;
    this.submitting.set(true);
    const raw = this.editForm.getRawValue();
    const payload = {
      name: raw.name,
      packagePrice: Number.parseInt(raw.packagePrice, 10),
      items: drinkPackageItemsFromForm(this.editItems.controls),
      isFreeMixer: raw.isFreeMixer,
      allowDeposit: raw.allowDeposit,
      freeDrinks: Number.parseInt(raw.freeDrinks, 10),
    };
    this.shopMaster.updatePromotion(item.id, payload).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeEdit();
        this.toast.showSuccess('บันทึกการแก้ไขเรียบร้อย');
        this.loadItems();
      },
      error: (err: { error?: { error?: string } }) => {
        this.submitting.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถแก้ไขโปรโมชั่นได้');
      },
    });
  }

  async confirmDelete(item: MstPromotion): Promise<void> {
    const ok = await this.confirmDialog.confirmDelete(`โปรโมชั่น "${item.name}"`);
    if (!ok) return;
    this.shopMaster.deletePromotion(item.id).subscribe({
      next: () => {
        this.toast.showSuccess('ลบโปรโมชั่นเรียบร้อย');
        this.loadItems();
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถลบโปรโมชั่นได้');
      },
    });
  }

  sanitizeIntegerInput(
    form: 'create' | 'edit',
    controlName: 'packagePrice' | 'freeDrinks',
    event: Event,
  ): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/\D+/g, '');
    const targetForm = form === 'create' ? this.createForm : this.editForm;
    targetForm.controls[controlName].setValue(sanitized, { emitEvent: false });
  }

  private resetItemLines(
    target: FormArray<DrinkPackageLineForm>,
    lines: DrinkPackageLineForm[],
  ): void {
    target.clear();
    for (const line of lines) {
      target.push(line);
    }
  }
}
