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

@Component({
  selector: 'app-custom-dropdown',
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
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) options: DropdownOption[] = [];
  @Input() placeholder = 'เลือก...';

  readonly isOpen = signal(false);
  readonly value = signal<number | string | null>(null);
  readonly disabled = signal(false);

  private overlayMenu: HTMLDivElement | null = null;
  private onChange: (value: number | string | null) => void = () => {};
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
    const current = this.value();
    if (current == null || current === '' || current === 0) {
      return this.placeholder;
    }
    const match = this.options.find(
      (o) => o.value === current || String(o.value) === String(current),
    );
    return match?.label ?? this.placeholder;
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
    menu.setAttribute('role', 'listbox');
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
        if (
          this.value() === option.value ||
          String(this.value()) === String(option.value)
        ) {
          btn.classList.add('app-dropdown-item-selected');
          btn.setAttribute('aria-selected', 'true');
        }
        btn.textContent = option.label;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.selectValue(option.value);
        });
        menu.appendChild(btn);
      }
    }

    getDropdownOverlayRoot().appendChild(menu);
    this.overlayMenu = menu;
    this.applyMenuPosition(menu, trigger);
    this.addScrollListener();
  }

  private selectValue(value: number | string): void {
    this.value.set(value);
    this.onChange(value);
    this.onTouched();
    this.closeMenu();
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
