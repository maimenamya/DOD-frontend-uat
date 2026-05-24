import { NgClass, NgStyle } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  Input,
  afterNextRender,
  forwardRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { getDropdownOverlayRoot } from './dropdown-overlay.util';

export interface DropdownOption {
  value: number | string;
  label: string;
}

const MENU_GAP_PX = 8;
/** Fixed cap for scrollable overlay — does not expand parent layout. */
export const DROPDOWN_MENU_MAX_HEIGHT_PX = 280;
const DROPDOWN_MENU_Z_INDEX = 9999;

@Component({
  selector: 'app-custom-dropdown',
  imports: [NgClass, NgStyle],
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
  private readonly menuPanel = viewChild<ElementRef<HTMLElement>>('menuPanel');

  @Input({ required: true }) options: DropdownOption[] = [];
  @Input() placeholder = 'เลือก...';

  readonly isOpen = signal(false);
  readonly menuVisible = signal(false);
  readonly value = signal<number | string | null>(null);
  readonly disabled = signal(false);
  readonly menuStyle = signal<Record<string, string>>({});

  private onChange: (value: number | string | null) => void = () => {};
  private onTouched: () => void = () => {};
  private scrollListenerActive = false;
  private suppressCloseUntil = 0;

  private readonly onScrollReposition = (): void => {
    if (this.isOpen()) {
      this.positionMenu();
    }
  };

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.removeScrollListener();
      this.detachMenuFromOverlay();
    });
  }

  readonly selectedLabel = () => {
    const current = this.value();
    if (current == null || current === '' || current === 0) {
      return this.placeholder;
    }
    return this.options.find((o) => o.value === current)?.label ?? this.placeholder;
  };

  toggleDropdown(event: MouseEvent): void {
    event.stopPropagation();

    if (this.disabled()) return;

    if (this.isOpen()) {
      this.closeMenu();
      return;
    }

    this.isOpen.set(true);
    this.onTouched();
    this.suppressCloseUntil = Date.now() + 100;

    afterNextRender(() => {
      this.openFloatingMenu(0);
    });
  }

  selectOption(option: DropdownOption, event: MouseEvent): void {
    event.stopPropagation();
    this.value.set(option.value);
    this.onChange(option.value);
    this.onTouched();
    this.closeMenu();
  }

  isSelected(option: DropdownOption): boolean {
    return this.value() === option.value;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (Date.now() < this.suppressCloseUntil) {
      return;
    }

    const target = event.target as Node;
    const inHost = this.elementRef.nativeElement.contains(target);
    const menu = this.menuPanel()?.nativeElement;
    const inMenu = menu?.contains(target) ?? false;

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

  private openFloatingMenu(attempt: number): void {
    const menu = this.menuPanel()?.nativeElement;
    if (!menu) {
      if (attempt < 5) {
        requestAnimationFrame(() => this.openFloatingMenu(attempt + 1));
      }
      return;
    }

    const overlayRoot = getDropdownOverlayRoot();
    if (menu.parentElement !== overlayRoot) {
      overlayRoot.appendChild(menu);
    }

    this.positionMenu();
    this.menuVisible.set(true);
    this.addScrollListener();
  }

  private closeMenu(): void {
    this.removeScrollListener();
    this.menuVisible.set(false);
    this.isOpen.set(false);
    this.menuStyle.set({});
  }

  private detachMenuFromOverlay(): void {
    const menu = this.menuPanel()?.nativeElement;
    if (!menu) {
      return;
    }

    const host = this.elementRef.nativeElement;
    if (menu.parentElement !== host) {
      host.appendChild(menu);
    }
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
    const maxMenuHeight = DROPDOWN_MENU_MAX_HEIGHT_PX;
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP_PX - viewportPadding;
    const spaceAbove = rect.top - MENU_GAP_PX - viewportPadding;

    let top = rect.bottom + MENU_GAP_PX;
    let maxHeight = Math.min(maxMenuHeight, spaceBelow);

    if (maxHeight < 120 && spaceAbove > spaceBelow) {
      maxHeight = Math.min(maxMenuHeight, spaceAbove);
      top = Math.max(viewportPadding, rect.top - MENU_GAP_PX - maxHeight);
    }

    maxHeight = Math.max(120, Math.min(maxMenuHeight, maxHeight));

    this.menuStyle.set({
      position: 'fixed',
      top: `${top}px`,
      left: `${rect.left}px`,
      width: `${Math.max(rect.width, 120)}px`,
      maxHeight: `${maxHeight}px`,
      zIndex: `${DROPDOWN_MENU_Z_INDEX}`,
    });
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
