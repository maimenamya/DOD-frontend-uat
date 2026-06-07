import {
  AfterViewInit,
  Component,
  ElementRef,
  forwardRef,
  input,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import flatpickr from 'flatpickr';
import { Thai } from 'flatpickr/dist/l10n/th.js';

import {
  formatShopDateLabelBe,
  isValidShopDateInput,
  shopDateInputToLocalDate,
} from '../../pages/open-table/open-table-ledger.util';

/** Date-only field — flatpickr popup (not native iOS date UI). Value: `YYYY-MM-DD` shop calendar. */
@Component({
  selector: 'app-shop-date-input',
  template: `
    <div class="app-shop-date-field">
      <input
        #input
        type="text"
        class="app-input app-shop-date-input w-full cursor-pointer"
        [attr.id]="inputId() ?? null"
        readonly
        autocomplete="off"
      />
    </div>
  `,
  styleUrl: './shop-date-input.component.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ShopDateInputComponent),
      multi: true,
    },
  ],
})
export class ShopDateInputComponent implements ControlValueAccessor, AfterViewInit, OnDestroy {
  readonly inputId = input<string | undefined>(undefined);
  readonly extraInputClass = input('');

  @ViewChild('input', { static: true }) private readonly inputRef!: ElementRef<HTMLInputElement>;

  private fp: flatpickr.Instance | null = null;
  private pendingValue = '';
  private disabled = false;
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  ngAfterViewInit(): void {
    this.fp = flatpickr(this.inputRef.nativeElement as Node, {
      locale: Thai,
      enableTime: false,
      dateFormat: 'Y-m-d',
      altInput: true,
      altFormat: 'd/m/Y',
      allowInput: false,
      monthSelectorType: 'static',
      disableMobile: true,
      clickOpens: true,
      appendTo: document.body,
      onReady: (_dates, _str, instance) => {
        instance.calendarContainer.classList.add('app-flatpickr-calendar');
        this.styleAltInput(instance);
        this.syncPickerFromPending();
      },
      onChange: (_dates, dateStr) => {
        this.pendingValue = dateStr.trim();
        this.updateAltDisplay();
        this.onChange(this.pendingValue);
      },
      onClose: () => {
        this.onTouched();
      },
    });
    this.applyDisabledState();
  }

  ngOnDestroy(): void {
    this.fp?.destroy();
    this.fp = null;
  }

  writeValue(value: string | null): void {
    this.pendingValue = value?.trim() ?? '';
    this.syncPickerFromPending();
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.applyDisabledState();
  }

  private syncPickerFromPending(): void {
    if (!this.fp) return;
    if (isValidShopDateInput(this.pendingValue)) {
      const local = shopDateInputToLocalDate(this.pendingValue);
      if (local) {
        this.fp.setDate(local, false);
        this.updateAltDisplay();
      }
    } else {
      this.fp.clear(false);
    }
  }

  private updateAltDisplay(): void {
    if (!this.fp?.altInput || !isValidShopDateInput(this.pendingValue)) return;
    this.fp.altInput.value = formatShopDateLabelBe(this.pendingValue);
  }

  private styleAltInput(instance: flatpickr.Instance): void {
    const alt = instance.altInput;
    if (!alt) return;
    alt.classList.add('app-input', 'app-shop-date-input', 'w-full', 'cursor-pointer');
    const extra = this.extraInputClass().trim();
    if (extra) {
      for (const cls of extra.split(/\s+/)) {
        alt.classList.add(cls);
      }
    }
  }

  private applyDisabledState(): void {
    const target = this.fp?.altInput ?? this.fp?.input ?? this.inputRef?.nativeElement ?? null;
    if (!target) return;
    target.classList.toggle('opacity-60', this.disabled);
    target.classList.toggle('pointer-events-none', this.disabled);
    if (this.disabled) {
      this.fp?.close();
    }
  }
}
