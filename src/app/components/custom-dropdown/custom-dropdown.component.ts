import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  Input,
  forwardRef,
  inject,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { getDropdownOverlayRoot } from './dropdown-overlay.util';

export interface DropdownOption {
  value: number | string;
  label: string;
}

const MENU_GAP_PX = 8;
export const DROPDOWN_MENU_MAX_HEIGHT_PX = 280;
const DROPDOWN_MENU_Z_INDEX = 9999;

type DropdownScalar = number | string;
type DropdownValue = DropdownScalar | DropdownScalar[] | null;

@Component({
  selector: 'app-custom-dropdown',
  templateUrl: './custom-dropdown.component.html',
  host: {
    class: 'app-dropdown-root',
    '[class.app-dropdown-root--open]': 'isOpen()',
    '[class.app-dropdown-root--multiple]': 'multiple',
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
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) options: DropdownOption[] = [];
  @Input() placeholder = 'เลือก...';
  @Input() multiple = false;

  readonly isOpen = signal(false);
  readonly value = signal<DropdownScalar | null>(null);
  readonly values = signal<DropdownScalar[]>([]);
  readonly disabled = signal(false);

  private overlayMenu: HTMLDivElement | null = null;
  private onChange: (value: DropdownValue) => void = () => {};
  private onTouched: () => void = () => {};
  private scrollListenerActive = false;
  private suppressCloseUntil = 0;

  private readonly onScrollReposition = (): void => {
    if (this.isOpen() && this.overlayMenu) {
      const trigger = this.getTrigger();
      if (trigger) {
        this.applyMenuPosition(this.overlayMenu, trigger);
      }
    }
  };

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.removeScrollListener();
      this.destroyOverlayMenu();
    });
  }

  readonly selectedLabel = () => {
    if (this.multiple) {
      const selected = this.values();
      if (selected.length === 0) {
        return this.placeholder;
      }
      const labels = selected
        .map((item) => this.optionLabel(item))
        .filter((label): label is string => !!label);
      return labels.length > 0 ? labels.join(', ') : this.placeholder;
    }

    const current = this.value();
    if (current == null || current === '' || current === 0) {
      return this.placeholder;
    }
    return this.optionLabel(current) ?? this.placeholder;
  };

  toggleDropdown(event: MouseEvent): void {
    event.stopPropagation();

    if (this.disabled()) {
      return;
    }

    if (this.isOpen()) {
      this.closeMenu();
      return;
    }

    this.isOpen.set(true);
    this.onTouched();
    this.suppressCloseUntil = Date.now() + 200;

    requestAnimationFrame(() => {
      this.buildAndOpenMenu();
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (Date.now() < this.suppressCloseUntil) {
      return;
    }

    const target = event.target as Node;
    const inHost = this.elementRef.nativeElement.contains(target);
    const inMenu = this.overlayMenu?.contains(target) ?? false;

    if (!inHost && !inMenu) {
      this.closeMenu();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeMenu();
  }

  @HostListener('window:resize')
  onViewportChange(): void {
    this.onScrollReposition();
  }

  writeValue(value: DropdownValue): void {
    if (this.multiple) {
      this.values.set(this.normalizeMultiValue(value));
      return;
    }
    this.value.set(this.normalizeScalarValue(value));
  }

  registerOnChange(fn: (value: DropdownValue) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  private normalizeScalarValue(value: DropdownValue): DropdownScalar | null {
    if (Array.isArray(value)) {
      return value[0] ?? null;
    }
    if (value == null || value === '') {
      return null;
    }
    return value;
  }

  private normalizeMultiValue(value: DropdownValue): DropdownScalar[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((item) => item != null && item !== '');
  }

  private optionLabel(value: DropdownScalar): string | undefined {
    const match = this.options.find(
      (option) => option.value === value || String(option.value) === String(value),
    );
    return match?.label;
  }

  private isSelected(value: DropdownScalar): boolean {
    if (this.multiple) {
      return this.values().some(
        (item) => item === value || String(item) === String(value),
      );
    }
    const current = this.value();
    return current === value || String(current) === String(value);
  }

  private buildAndOpenMenu(): void {
    if (!this.isOpen()) {
      return;
    }

    const trigger = this.getTrigger();
    if (!trigger) {
      return;
    }

    this.destroyOverlayMenu();

    const menu = document.createElement('div');
    menu.className = 'app-dropdown-menu app-dropdown-menu--visible';
    if (this.multiple) {
      menu.classList.add('app-dropdown-menu--multiple');
    }
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-multiselectable', this.multiple ? 'true' : 'false');
    menu.addEventListener('click', (e) => e.stopPropagation());

    if (this.options.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'app-dropdown-empty';
      empty.textContent = 'ไม่มีรายการ';
      menu.appendChild(empty);
    } else {
      for (const option of this.options) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'app-dropdown-item';
        btn.setAttribute('role', 'option');
        if (this.isSelected(option.value)) {
          btn.classList.add('app-dropdown-item-selected');
          btn.setAttribute('aria-selected', 'true');
        }
        if (this.multiple) {
          const mark = document.createElement('span');
          mark.className = 'app-dropdown-item-check';
          mark.setAttribute('aria-hidden', 'true');
          mark.textContent = this.isSelected(option.value) ? '✓' : '';
          btn.appendChild(mark);
          const label = document.createElement('span');
          label.className = 'app-dropdown-item-label';
          label.textContent = option.label;
          btn.appendChild(label);
        } else {
          btn.textContent = option.label;
        }
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.multiple) {
            this.toggleMultiValue(option.value);
          } else {
            this.selectValue(option.value);
          }
        });
        menu.appendChild(btn);
      }
    }

    getDropdownOverlayRoot().appendChild(menu);
    this.overlayMenu = menu;
    this.applyMenuPosition(menu, trigger);
    this.addScrollListener();
  }

  private selectValue(value: DropdownScalar): void {
    this.value.set(value);
    this.onChange(value);
    this.onTouched();
    this.closeMenu();
  }

  private toggleMultiValue(value: DropdownScalar): void {
    const current = this.values();
    const exists = current.some(
      (item) => item === value || String(item) === String(value),
    );
    const next = exists
      ? current.filter((item) => item !== value && String(item) !== String(value))
      : [...current, value];
    this.values.set(next);
    this.onChange(next);
    this.onTouched();
    this.refreshOpenMenuSelection();
  }

  private refreshOpenMenuSelection(): void {
    if (!this.overlayMenu) {
      return;
    }
    const buttons = this.overlayMenu.querySelectorAll<HTMLButtonElement>('.app-dropdown-item');
    buttons.forEach((btn, index) => {
      const option = this.options[index];
      if (!option) return;
      const selected = this.isSelected(option.value);
      btn.classList.toggle('app-dropdown-item-selected', selected);
      btn.setAttribute('aria-selected', selected ? 'true' : 'false');
      if (this.multiple) {
        const mark = btn.querySelector('.app-dropdown-item-check');
        if (mark) {
          mark.textContent = selected ? '✓' : '';
        }
      }
    });
  }

  private closeMenu(): void {
    this.removeScrollListener();
    this.destroyOverlayMenu();
    this.isOpen.set(false);
  }

  private destroyOverlayMenu(): void {
    if (this.overlayMenu) {
      this.overlayMenu.remove();
      this.overlayMenu = null;
    }
  }

  private getTrigger(): HTMLButtonElement | null {
    return this.elementRef.nativeElement.querySelector('.app-dropdown-trigger');
  }

  private applyMenuPosition(menu: HTMLElement, trigger: HTMLElement): void {
    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 12;
    const maxMenuHeight = DROPDOWN_MENU_MAX_HEIGHT_PX;
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP_PX - viewportPadding;
    const spaceAbove = rect.top - MENU_GAP_PX - viewportPadding;

    const contentHeight = menu.scrollHeight;
    const naturalHeight = Math.min(
      maxMenuHeight,
      Math.max(contentHeight, this.options.length === 0 ? 48 : 40),
    );

    const fitsBelow = spaceBelow >= naturalHeight;
    const fitsAbove = spaceAbove >= naturalHeight;
    let openBelow = fitsBelow || !fitsAbove;
    if (fitsBelow && fitsAbove) {
      openBelow = true;
    }

    let top: number;
    let maxHeight: number;

    if (openBelow) {
      top = rect.bottom + MENU_GAP_PX;
      maxHeight = Math.min(maxMenuHeight, spaceBelow, naturalHeight);
    } else {
      maxHeight = Math.min(maxMenuHeight, spaceAbove, naturalHeight);
      top = Math.max(viewportPadding, rect.top - MENU_GAP_PX - maxHeight);
    }

    maxHeight = Math.max(48, maxHeight);

    menu.style.position = 'fixed';
    menu.style.top = `${top}px`;
    menu.style.left = `${rect.left}px`;
    menu.style.width = `${Math.max(rect.width, 120)}px`;
    menu.style.maxHeight = `${maxHeight}px`;
    menu.style.zIndex = String(DROPDOWN_MENU_Z_INDEX);
    menu.style.display = 'block';
  }

  private addScrollListener(): void {
    if (this.scrollListenerActive) {
      return;
    }
    document.addEventListener('scroll', this.onScrollReposition, true);
    this.scrollListenerActive = true;
  }

  private removeScrollListener(): void {
    if (!this.scrollListenerActive) {
      return;
    }
    document.removeEventListener('scroll', this.onScrollReposition, true);
    this.scrollListenerActive = false;
  }
}
