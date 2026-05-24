import { NgStyle } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  Input,
  forwardRef,
  inject,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface DropdownOption {
  value: number | string;
  label: string;
}

const MENU_GAP_PX = 8;

@Component({
  selector: 'app-custom-dropdown',
  imports: [NgStyle],
  templateUrl: './custom-dropdown.component.html',
  host: {
    class: 'app-dropdown-root',
    '[class.app-dropdown-root--open]': 'isOpen()',
  },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomDropdownComponent),
      multi: true,
    },
  ],
})
export class CustomDropdownComponent implements ControlValueAccessor {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  @Input({ required: true }) options: DropdownOption[] = [];
  @Input() placeholder = 'เลือก...';

  readonly isOpen = signal(false);
  readonly value = signal<number | string | null>(null);
  readonly disabled = signal(false);
  readonly menuStyle = signal<Record<string, string>>({});

  private onChange: (value: number | string | null) => void = () => {};
  private onTouched: () => void = () => {};

  readonly selectedLabel = () => {
    const current = this.value();
    if (current == null || current === '' || current === 0) {
      return this.placeholder;
    }
    return this.options.find((o) => o.value === current)?.label ?? this.placeholder;
  };

  toggleDropdown(): void {
    if (this.disabled()) return;
    const nextOpen = !this.isOpen();
    this.isOpen.set(nextOpen);
    if (nextOpen) {
      this.onTouched();
      requestAnimationFrame(() => this.positionMenu());
    } else {
      this.menuStyle.set({});
    }
  }

  selectOption(option: DropdownOption): void {
    this.value.set(option.value);
    this.onChange(option.value);
    this.onTouched();
    this.isOpen.set(false);
    this.menuStyle.set({});
  }

  isSelected(option: DropdownOption): boolean {
    return this.value() === option.value;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.isOpen.set(false);
      this.menuStyle.set({});
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.isOpen.set(false);
    this.menuStyle.set({});
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  onViewportChange(): void {
    if (this.isOpen()) {
      this.positionMenu();
    }
  }

  writeValue(value: number | string | null): void {
    this.value.set(value);
  }

  registerOnChange(fn: (value: number | string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  private positionMenu(): void {
    const trigger = this.elementRef.nativeElement.querySelector(
      '.app-dropdown-trigger',
    ) as HTMLElement | null;
    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 12;
    const maxHeight = Math.min(16 * 16, window.innerHeight - rect.bottom - MENU_GAP_PX - viewportPadding);

    this.menuStyle.set({
      position: 'fixed',
      top: `${rect.bottom + MENU_GAP_PX}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      maxHeight: `${Math.max(120, maxHeight)}px`,
      zIndex: '300',
    });
  }
}
