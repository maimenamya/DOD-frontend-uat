import { NgStyle } from '@angular/common';
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly menuPanel = viewChild<ElementRef<HTMLElement>>('menuPanel');

  @Input({ required: true }) options: DropdownOption[] = [];
  @Input() placeholder = 'เลือก...';

  readonly isOpen = signal(false);
  readonly value = signal<number | string | null>(null);
  readonly disabled = signal(false);
  readonly menuStyle = signal<Record<string, string>>({});

  private onChange: (value: number | string | null) => void = () => {};
  private onTouched: () => void = () => {};
  private scrollListenerActive = false;

  private readonly onScrollReposition = (): void => {
    if (this.isOpen()) {
      this.positionMenu();
    }
  };

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.removeScrollListener();
      const menu = this.menuPanel()?.nativeElement;
      if (menu?.parentElement === document.body) {
        menu.remove();
      }
    });
  }

  readonly selectedLabel = () => {
    const current = this.value();
    if (current == null || current === '' || current === 0) {
      return this.placeholder;
    }
    return this.options.find((o) => o.value === current)?.label ?? this.placeholder;
  };

  toggleDropdown(): void {
    if (this.disabled()) return;

    if (this.isOpen()) {
      this.closeMenu();
      return;
    }

    this.isOpen.set(true);
    this.onTouched();

    afterNextRender(() => {
      this.portalMenuToBody();
      this.positionMenu();
      this.addScrollListener();
    });
  }

  selectOption(option: DropdownOption): void {
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

  private closeMenu(): void {
    this.removeScrollListener();
    this.isOpen.set(false);
    this.menuStyle.set({});
  }

  /**
   * Modals use backdrop-filter which creates a new containing block — `position: fixed`
   * inside them uses wrong coordinates. Portaling the menu to `body` fixes placement.
   */
  private portalMenuToBody(): void {
    const menu = this.menuPanel()?.nativeElement;
    if (!menu || menu.parentElement === document.body) {
      return;
    }
    document.body.appendChild(menu);
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
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP_PX - viewportPadding;
    const spaceAbove = rect.top - MENU_GAP_PX - viewportPadding;
    const preferredMax = 16 * 16;

    let top = rect.bottom + MENU_GAP_PX;
    let maxHeight = Math.min(preferredMax, spaceBelow);

    if (maxHeight < 120 && spaceAbove > spaceBelow) {
      maxHeight = Math.min(preferredMax, spaceAbove);
      top = rect.top - MENU_GAP_PX - maxHeight;
    }

    this.menuStyle.set({
      position: 'fixed',
      top: `${Math.max(viewportPadding, top)}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      maxHeight: `${Math.max(120, maxHeight)}px`,
      zIndex: '400',
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
