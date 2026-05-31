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
import confirmDatePlugin from 'flatpickr/dist/plugins/confirmDate/confirmDate';

import {
  currentDatetimeLocalValue,
  isValidShopDatetimeLocal,
  splitShopDatetimeLocal,
} from '../../pages/open-table/open-table-ledger.util';

/** Date + time field — opens a popup calendar on click (appendTo body for modals). */
@Component({
  selector: 'app-shop-datetime-input',
  template: `
    <div class="app-shop-datetime-field">
      <input
        #input
        type="text"
        class="app-input app-shop-datetime-input w-full cursor-pointer"
        [attr.id]="inputId() ?? null"
        readonly
        autocomplete="off"
      />
    </div>
  `,
  styleUrl: './shop-datetime-input.component.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ShopDatetimeInputComponent),
      multi: true,
    },
  ],
})
export class ShopDatetimeInputComponent
  implements ControlValueAccessor, AfterViewInit, OnDestroy
{
  readonly inputId = input<string | undefined>(undefined);
  /** Emit ngModel only after user taps ยืนยัน in the picker (avoids API calls per arrow/day). */
  readonly requireConfirm = input(false);

  @ViewChild('input', { static: true }) private readonly inputRef!: ElementRef<HTMLInputElement>;

  private fp: flatpickr.Instance | null = null;
  private pendingValue = currentDatetimeLocalValue();
  private committedShopValue = '';
  private closeConfirmed = false;
  private disabled = false;
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};
  private clickTarget: HTMLElement | null = null;
  private readonly onClickTarget = (event: MouseEvent): void => {
    event.stopPropagation();
    if (this.disabled || !this.fp) return;
    if (this.fp.isOpen) {
      this.fp.close();
    } else {
      this.fp.open();
    }
  };

  ngAfterViewInit(): void {
    const needsConfirm = this.requireConfirm();
    this.fp = flatpickr(this.inputRef.nativeElement, {
      locale: Thai,
      enableTime: true,
      dateFormat: 'Y-m-d H:i',
      altInput: true,
      altFormat: 'd/m/Y H:i',
      time_24hr: true,
      minuteIncrement: 1,
      allowInput: false,
      monthSelectorType: 'static',
      disableMobile: true,
      appendTo: document.body,
      clickOpens: false,
      position: 'auto',
      plugins: needsConfirm
        ? [
            confirmDatePlugin({
              showAlways: true,
              confirmText: 'ยืนยัน',
              confirmIcon: '',
              theme: 'darkTheme',
            }),
          ]
        : [],
      onReady: (_dates, _str, instance) => {
        instance.calendarContainer.classList.add('app-flatpickr-calendar');
        this.clickTarget = instance.altInput ?? instance.input;
        this.clickTarget.classList.add('cursor-pointer');
        this.clickTarget.addEventListener('click', this.onClickTarget);
        if (needsConfirm) {
          const confirmEl = instance.calendarContainer.querySelector('.flatpickr-confirm');
          confirmEl?.addEventListener(
            'click',
            () => {
              this.closeConfirmed = true;
            },
            { capture: true },
          );
        }
      },
      onOpen: (_dates, _str, instance) => {
        if (needsConfirm) {
          this.committedShopValue = this.pendingValue;
          this.closeConfirmed = false;
        }
        requestAnimationFrame(() => instance._positionCalendar());
      },
      onClose: () => {
        if (needsConfirm && this.fp) {
          if (this.closeConfirmed && isValidShopDatetimeLocal(this.pendingValue)) {
            this.onChange(this.pendingValue);
          } else {
            this.pendingValue = this.committedShopValue;
            if (isValidShopDatetimeLocal(this.committedShopValue)) {
              this.fp.setDate(this.shopToFlatpickrDisplay(this.committedShopValue), false);
            }
          }
        }
        this.onTouched();
      },
      onChange: (_dates, dateStr) => {
        const shop = this.flatpickrDisplayToShop(dateStr);
        this.pendingValue = shop;
        if (!needsConfirm) {
          this.onChange(shop);
        }
      },
    });

    if (isValidShopDatetimeLocal(this.pendingValue)) {
      this.fp.setDate(this.shopToFlatpickrDisplay(this.pendingValue), false);
    }
    this.applyDisabledToClickTarget();
  }

  ngOnDestroy(): void {
    this.clickTarget?.removeEventListener('click', this.onClickTarget);
    this.fp?.destroy();
    this.fp = null;
  }

  writeValue(value: string | null): void {
    this.pendingValue = value?.trim() ?? '';
    if (!this.fp) return;
    if (isValidShopDatetimeLocal(this.pendingValue)) {
      this.fp.setDate(this.shopToFlatpickrDisplay(this.pendingValue), false);
    } else {
      this.fp.clear(false);
    }
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.applyDisabledToClickTarget();
  }

  private applyDisabledToClickTarget(): void {
    const target = this.clickTarget ?? this.fp?.altInput ?? this.fp?.input ?? null;
    if (!target) return;
    target.classList.toggle('opacity-60', this.disabled);
    target.classList.toggle('pointer-events-none', this.disabled);
  }

  private shopToFlatpickrDisplay(shop: string): string {
    const { datePart, hour, minute } = splitShopDatetimeLocal(shop);
    return `${datePart} ${hour}:${minute}`;
  }

  private flatpickrDisplayToShop(display: string): string {
    const trimmed = display.trim();
    if (!trimmed) return '';
    const match = /^(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2})/.exec(trimmed);
    if (!match) return '';
    return `${match[1]}T${match[2]}:${match[3]}`;
  }
}
