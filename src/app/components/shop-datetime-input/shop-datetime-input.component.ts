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
  currentDatetimeLocalValue,
  formatShopDatetimeLabelBe,
  isValidShopDatetimeLocal,
  splitShopDatetimeLocal,
} from '../../pages/open-table/open-table-ledger.util';
import {
  bindShopFlatpickrConfirmButton,
  bindShopFlatpickrTimeInputsWithConfirm,
  blurShopFlatpickrTypingFocus,
  closeShopFlatpickrMobileChrome,
  isShopFlatpickrMobileViewport,
  mountShopFlatpickrMobileTimeWheels,
  setupShopFlatpickrMobileKeyboardGuard,
  shopFlatpickrConfirmDatePlugins,
  syncShopFlatpickrOnOpen,
  scheduleShopFlatpickrAltOverride,
  unmountShopFlatpickrMobileTimeWheels,
  unwatchShopFlatpickrKeyboardOverlap,
  watchShopFlatpickrKeyboardOverlap,
  applyShopFlatpickrTimeFromInputs,
} from '../../utils/flatpickr-shop.util';

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

  @ViewChild('input', { static: true }) private readonly inputRef!: ElementRef<HTMLInputElement>;

  private fp: flatpickr.Instance | null = null;
  private pendingValue = currentDatetimeLocalValue();
  private committedShopValue = '';
  private closeConfirmed = false;
  private disabled = false;
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};
  private clickTarget: HTMLElement | null = null;
  private timeInputTeardown: (() => void) | null = null;
  private timeWheelTeardown: (() => void) | null = null;
  private keyboardGuardTeardown: (() => void) | null = null;
  private confirmButtonTeardown: (() => void) | null = null;
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
      plugins: shopFlatpickrConfirmDatePlugins(),
      onReady: (_dates, _str, instance) => {
        instance.calendarContainer.classList.add('app-flatpickr-calendar');
        this.clickTarget = instance.altInput ?? instance.input;
        this.clickTarget.classList.add('cursor-pointer');
        this.clickTarget.addEventListener('click', this.onClickTarget);
        this.syncPickerFromPending(instance);
        this.keyboardGuardTeardown?.();
        this.keyboardGuardTeardown = setupShopFlatpickrMobileKeyboardGuard(instance);
      },
      onOpen: (_dates, _str, instance) => {
        this.committedShopValue = this.pendingValue;
        this.closeConfirmed = false;
        syncShopFlatpickrOnOpen(instance);
        this.syncPickerFromPending(instance);
        if (isValidShopDatetimeLocal(this.pendingValue)) {
          instance.jumpToDate(this.shopToFlatpickrDisplay(this.pendingValue), false);
        }
        this.bindPickerInteractions(instance);
        watchShopFlatpickrKeyboardOverlap(instance);
        this.scheduleBeAltDisplay(instance);
      },
      onValueUpdate: (_dates, _str, instance) => {
        this.scheduleBeAltDisplay(instance);
      },
      onClose: () => {
        unwatchShopFlatpickrKeyboardOverlap();
        this.teardownPickerInteractions();
        if (this.fp) {
          if (this.closeConfirmed && isValidShopDatetimeLocal(this.pendingValue)) {
            this.committedShopValue = this.pendingValue;
            this.emitModelValue(this.pendingValue);
          } else if (!this.closeConfirmed) {
            this.pendingValue = this.committedShopValue;
            if (isValidShopDatetimeLocal(this.committedShopValue)) {
              this.fp.setDate(this.shopToFlatpickrDisplay(this.committedShopValue), false);
            }
          }
        }
        this.scheduleBeAltDisplay();
        this.onTouched();
      },
      onKeyDown: (_dates, _str, instance, e) => {
        if (e.key !== 'Enter') return;
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;
        if (!target.classList.contains('flatpickr-confirm')) return;
        this.capturePickerSelection(instance);
        this.closeConfirmed = true;
      },
      onChange: (_dates, dateStr, instance) => {
        const shop = this.flatpickrDisplayToShop(dateStr);
        this.pendingValue = shop;
        this.scheduleBeAltDisplay(instance);
        if (isShopFlatpickrMobileViewport()) {
          requestAnimationFrame(() => blurShopFlatpickrTypingFocus(instance));
          globalThis.setTimeout(() => blurShopFlatpickrTypingFocus(instance), 50);
        }
      },
    });

    this.syncPickerFromPending();
    this.applyDisabledToClickTarget();
  }

  ngOnDestroy(): void {
    this.clickTarget?.removeEventListener('click', this.onClickTarget);
    this.teardownPickerInteractions();
    this.keyboardGuardTeardown?.();
    this.keyboardGuardTeardown = null;
    unwatchShopFlatpickrKeyboardOverlap();
    closeShopFlatpickrMobileChrome();
    this.fp?.destroy();
    this.fp = null;
  }

  writeValue(value: string | null): void {
    this.pendingValue = value?.trim() ?? '';
    this.committedShopValue = this.pendingValue;
    this.syncPickerFromPending();
  }

  /** Flush open picker edits into ngModel before form submit. */
  commitPendingToModel(): string {
    const fp = this.fp;
    if (fp?.isOpen) {
      this.capturePickerSelection(fp);
      this.committedShopValue = this.pendingValue;
      this.closeConfirmed = true;
      fp.close();
    } else if (isValidShopDatetimeLocal(this.pendingValue)) {
      this.committedShopValue = this.pendingValue;
      this.emitModelValue(this.pendingValue);
    }
    return this.pendingValue;
  }

  private bindPickerInteractions(instance: flatpickr.Instance): void {
    this.teardownPickerInteractions();

    this.confirmButtonTeardown = bindShopFlatpickrConfirmButton(instance, () => {
      this.capturePickerSelection(instance);
      this.closeConfirmed = true;
    });

    if (isShopFlatpickrMobileViewport()) {
      requestAnimationFrame(() => {
        this.timeWheelTeardown = mountShopFlatpickrMobileTimeWheels(instance, {
          onTimeApplied: () => this.capturePickerSelection(instance),
          shopDatetime: this.pendingValue,
        });
        blurShopFlatpickrTypingFocus(instance);
      });
      return;
    }

    this.timeInputTeardown = bindShopFlatpickrTimeInputsWithConfirm(instance, {
      onTimeApplied: () => this.capturePickerSelection(instance),
    });
  }

  private teardownPickerInteractions(): void {
    this.confirmButtonTeardown?.();
    this.confirmButtonTeardown = null;
    this.timeInputTeardown?.();
    this.timeInputTeardown = null;
    this.timeWheelTeardown?.();
    this.timeWheelTeardown = null;
    unmountShopFlatpickrMobileTimeWheels();
  }

  /** Read hour/minute inputs into flatpickr selection (PC arrows may skip blur). */
  private capturePickerSelection(instance: flatpickr.Instance): void {
    applyShopFlatpickrTimeFromInputs(instance);
    this.syncPendingFromFlatpickr(instance);
  }

  private syncPickerFromPending(instance?: flatpickr.Instance): void {
    const fp = instance ?? this.fp;
    if (!fp) return;
    if (isValidShopDatetimeLocal(this.pendingValue)) {
      fp.setDate(this.shopToFlatpickrDisplay(this.pendingValue), false);
      this.updateAltDisplay(fp);
    } else {
      fp.clear(false);
    }
  }

  private updateAltDisplay(instance?: flatpickr.Instance): void {
    const fp = instance ?? this.fp;
    if (!fp?.altInput || !isValidShopDatetimeLocal(this.pendingValue)) return;
    fp.altInput.value = formatShopDatetimeLabelBe(this.pendingValue);
  }

  private scheduleBeAltDisplay(instance?: flatpickr.Instance): void {
    scheduleShopFlatpickrAltOverride(() => this.updateAltDisplay(instance));
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

  private syncPendingFromFlatpickr(instance: flatpickr.Instance): void {
    const selected = instance.selectedDates[0];
    if (!selected) return;
    const display = instance.formatDate(selected, instance.config.dateFormat);
    const shop = this.flatpickrDisplayToShop(display);
    if (isValidShopDatetimeLocal(shop)) {
      this.pendingValue = shop;
      this.updateAltDisplay(instance);
    }
  }

  private emitModelValue(shop: string): void {
    if (!isValidShopDatetimeLocal(shop)) return;
    this.onChange(shop);
  }
}
