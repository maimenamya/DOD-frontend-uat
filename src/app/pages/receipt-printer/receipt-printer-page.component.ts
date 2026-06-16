import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { CustomDropdownComponent } from '../../components/custom-dropdown/custom-dropdown.component';
import {
  RECEIPT_PAPER_WIDTH_OPTIONS,
  RECEIPT_PRINT_MODE_OPTIONS,
  type ReceiptPrintChannel,
  type ShopReceiptPrinterConfig,
} from '../../models/shop-receipt-printer';
import { AuthService } from '../../services/auth.service';
import { ShopReceiptPrinterService } from '../../services/shop-receipt-printer.service';
import { ToastService } from '../../services/toast.service';
import {
  highlightInvalidForm,
  resetFormValidationFlag,
} from '../../utils/form-validation.util';

@Component({
  selector: 'app-receipt-printer-page',
  imports: [ReactiveFormsModule, CustomDropdownComponent],
  templateUrl: './receipt-printer-page.component.html',
})
export class ReceiptPrinterPageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly printerService = inject(ShopReceiptPrinterService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly canManage = computed(() => this.auth.canWriteOnPage('master_data'));
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly formValidated = signal(false);

  readonly printModeOptions = RECEIPT_PRINT_MODE_OPTIONS.map((o) => ({
    value: o.value,
    label: o.label,
  }));
  readonly paperWidthOptions = RECEIPT_PAPER_WIDTH_OPTIONS.map((o) => ({
    value: String(o.value),
    label: o.label,
  }));

  readonly form = this.fb.group({
    printMode: ['auto' as ReceiptPrintChannel, Validators.required],
    paperWidthMm: ['58', Validators.required],
    headerText: [''],
    footerText: [''],
    printerHost: [''],
    printerPort: ['9100'],
  });

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    const shopId = this.auth.getShopId();
    if (shopId == null) {
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.printerService.get(shopId).subscribe({
      next: (config) => {
        this.patchForm(config);
        this.loading.set(false);
      },
      error: () => {
        this.toast.showError('โหลดการตั้งค่าเครื่องพิมพ์ไม่สำเร็จ');
        this.loading.set(false);
      },
    });
  }

  submit(): void {
    if (!this.canManage()) return;
    resetFormValidationFlag(this.formValidated);
    if (highlightInvalidForm(this.form, this.formValidated, this.toast)) return;

    const shopId = this.auth.getShopId();
    if (shopId == null) {
      this.toast.showError('ไม่พบสาขา');
      return;
    }

    const v = this.form.getRawValue();
    const printMode = v.printMode;
    this.submitting.set(true);
    this.printerService
      .save(shopId, {
        printMode,
        paperWidthMm: Number(v.paperWidthMm),
        headerText: v.headerText.trim() || null,
        footerText: v.footerText.trim() || null,
        printerHost: printMode === 'wifi_raw' ? v.printerHost.trim() || null : null,
        printerPort:
          printMode === 'wifi_raw' && v.printerPort.trim()
            ? Number(v.printerPort)
            : null,
      })
      .subscribe({
        next: (config) => {
          this.patchForm(config);
          this.submitting.set(false);
          this.toast.showSuccess('บันทึกการตั้งค่าเครื่องพิมพ์แล้ว');
        },
        error: (err) => {
          this.submitting.set(false);
          const msg =
            typeof err?.error?.error === 'string'
              ? err.error.error
              : 'บันทึกการตั้งค่าเครื่องพิมพ์ไม่สำเร็จ';
          this.toast.showError(msg);
        },
      });
  }

  private patchForm(config: ShopReceiptPrinterConfig): void {
    this.form.patchValue({
      printMode: config.printMode ?? 'auto',
      paperWidthMm: String(config.paperWidthMm ?? 58),
      headerText: config.headerText ?? '',
      footerText: config.footerText ?? '',
      printerHost: config.printerHost ?? '',
      printerPort: config.printerPort != null ? String(config.printerPort) : '9100',
    });
    if (!this.canManage()) {
      this.form.disable();
    }
  }
}
