import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  SimpleChanges,
  forwardRef,
  inject,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { DROPDOWN_MENU_MAX_HEIGHT_PX } from '../custom-dropdown/custom-dropdown.component';
import { getDropdownOverlayRoot } from '../custom-dropdown/dropdown-overlay.util';
import { scheduleAppFieldReveal } from '../../utils/app-keyboard-viewport.util';

export interface ComboboxOption {
  value: number | string;
  label: string;
  hint?: string;
}

const MENU_GAP_PX = 8;
const DROPDOWN_MENU_Z_INDEX = 10000;

@Component({
  selector: 'app-searchable-combobox',
  templateUrl: './searchable-combobox.component.html',
  host: {
    class: 'app-dropdown-root',
    '[class.app-dropdown-root--open]': 'isOpen()',
  },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchableComboboxComponent),
      multi: true,
    },
  ],
})
export class SearchableComboboxComponent implements ControlValueAccessor, OnChanges {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) options: ComboboxOption[] = [];
  @Input() placeholder = 'ค้นหาและเลือก...';
  @Input() searchPlaceholder = 'พิมพ์เพื่อค้นหา...';
  @Input() emptyLabel = 'ไม่พบรายการ';
  @Input() disableWhenEmpty = false;

  readonly isOpen = signal(false);
  readonly value = signal<number | string | null>(null);
  readonly disabled = signal(false);
  readonly query = signal('');

  private overlayMenu: HTMLDivElement | null = null;
  private searchInput: HTMLInputElement | null = null;
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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['options']) {
      this.pruneInvalidSelection();
      if (this.isOpen() && this.overlayMenu) {
        this.rebuildList();
      }
    }
  }

  readonly selectedLabel = () => {
    const current = this.value();
    if (current == null || current === '') {
      return this.placeholder;
    }
    const match = this.options.find(
      (o) => o.value === current || String(o.value) === String(current),
    );
    return match?.label ?? this.placeholder;
  };

  readonly filteredOptions = () => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.options;
    return this.options.filter((o) => {
      const hay = `${o.label} ${o.hint ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  };

  toggleDropdown(event: MouseEvent): void {
    event.stopPropagation();
    if (this.disabled() || (this.disableWhenEmpty && this.options.length === 0)) return;
    if (this.isOpen()) {
      this.closeMenu();
      return;
    }
    this.isOpen.set(true);
    this.query.set('');
    this.onTouched();
    this.suppressCloseUntil = Date.now() + 200;
    requestAnimationFrame(() => this.buildAndOpenMenu());
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (Date.now() < this.suppressCloseUntil) return;
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
    this.pruneInvalidSelection();
  }

  private pruneInvalidSelection(): void {
    const current = this.value();
    if (current == null || current === '') return;
    const valid = this.options.some(
      (option) =>
        option.value === current || String(option.value) === String(current),
    );
    if (!valid) {
      this.value.set(null);
      this.onChange(null);
    }
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

  onSearchInput(value: string): void {
    this.query.set(value);
    this.rebuildList();
  }

  private buildAndOpenMenu(): void {
    if (!this.isOpen()) return;
    const trigger = this.getTrigger();
    if (!trigger) return;

    this.destroyOverlayMenu();

    const menu = document.createElement('div');
    menu.className = 'app-dropdown-menu app-dropdown-menu--visible app-combobox-menu';
    menu.setAttribute('role', 'listbox');
    menu.addEventListener('click', (e) => e.stopPropagation());

    const searchWrap = document.createElement('div');
    searchWrap.className = 'app-combobox-search-wrap';
    const search = document.createElement('input');
    search.type = 'text';
    search.className = 'app-combobox-search';
    search.placeholder = this.searchPlaceholder;
    search.value = this.query();
    search.addEventListener('input', (e) => {
      this.onSearchInput((e.target as HTMLInputElement).value);
    });
    search.addEventListener('click', (e) => e.stopPropagation());
    searchWrap.appendChild(search);
    menu.appendChild(searchWrap);
    this.searchInput = search;

    const list = document.createElement('div');
    list.className = 'app-combobox-list';
    menu.appendChild(list);

    getDropdownOverlayRoot().appendChild(menu);
    this.overlayMenu = menu;
    this.rebuildList();
    this.applyMenuPosition(menu, trigger);
    this.addScrollListener();
    scheduleAppFieldReveal(trigger);
    requestAnimationFrame(() => {
      scheduleAppFieldReveal(trigger);
      search.focus();
    });
  }

  private rebuildList(): void {
    if (!this.overlayMenu) return;
    const list = this.overlayMenu.querySelector('.app-combobox-list');
    if (!list) return;
    list.innerHTML = '';

    const options = this.filteredOptions();
    if (options.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'app-dropdown-empty';
      empty.textContent = this.emptyLabel;
      list.appendChild(empty);
      return;
    }

    for (const option of options) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'app-dropdown-item app-combobox-item';
      btn.setAttribute('role', 'option');
      if (
        this.value() === option.value ||
        String(this.value()) === String(option.value)
      ) {
        btn.classList.add('app-dropdown-item-selected');
        btn.setAttribute('aria-selected', 'true');
      }
      const label = document.createElement('span');
      label.className = 'app-combobox-item-label';
      label.textContent = option.label;
      btn.appendChild(label);
      if (option.hint) {
        const hint = document.createElement('span');
        hint.className = 'app-combobox-item-hint';
        hint.textContent = option.hint;
        btn.appendChild(hint);
      }
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectValue(option.value);
      });
      list.appendChild(btn);
    }
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
    this.query.set('');
  }

  private destroyOverlayMenu(): void {
    if (this.overlayMenu) {
      this.overlayMenu.remove();
      this.overlayMenu = null;
      this.searchInput = null;
    }
  }

  private getTrigger(): HTMLButtonElement | null {
    return this.elementRef.nativeElement.querySelector('.app-dropdown-trigger');
  }

  private applyMenuPosition(menu: HTMLElement, trigger: HTMLElement): void {
    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 12;
    const maxMenuHeight = DROPDOWN_MENU_MAX_HEIGHT_PX + 48;
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP_PX - viewportPadding;
    const spaceAbove = rect.top - MENU_GAP_PX - viewportPadding;

    let top = rect.bottom + MENU_GAP_PX;
    let maxHeight = Math.min(maxMenuHeight, spaceBelow);

    if (maxHeight < 160 && spaceAbove > spaceBelow) {
      maxHeight = Math.min(maxMenuHeight, spaceAbove);
      top = Math.max(viewportPadding, rect.top - MENU_GAP_PX - maxHeight);
    }

    maxHeight = Math.max(160, Math.min(maxMenuHeight, maxHeight));

    menu.style.position = 'fixed';
    menu.style.top = `${top}px`;
    menu.style.left = `${rect.left}px`;
    menu.style.width = `${Math.max(rect.width, 120)}px`;
    menu.style.maxHeight = `${maxHeight}px`;
    menu.style.zIndex = String(DROPDOWN_MENU_Z_INDEX);
    menu.style.display = 'block';
  }

  private addScrollListener(): void {
    if (this.scrollListenerActive) return;
    document.addEventListener('scroll', this.onScrollReposition, true);
    this.scrollListenerActive = true;
  }

  private removeScrollListener(): void {
    if (!this.scrollListenerActive) return;
    document.removeEventListener('scroll', this.onScrollReposition, true);
    this.scrollListenerActive = false;
  }
}
