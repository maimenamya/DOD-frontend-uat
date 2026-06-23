import { APP_MOBILE_MEDIA_QUERY, isAppMobileViewport } from './app-viewport.util';

/** Minimum overlap (px) before treating the on-screen keyboard as open. */
export const APP_KEYBOARD_OVERLAP_THRESHOLD_PX = 60;

const FOCUSABLE_FIELD_SELECTOR =
  'input:not([type="hidden"]):not([disabled]):not([readonly]), textarea:not([disabled]), select:not([disabled]), [contenteditable="true"]';

const APP_SCROLL_CONTAINER_SELECTOR = [
  '.open-table-mobile-sheet',
  '.app-modal-scroll',
  '.app-main-content',
  '.login-page',
  '.app-scroll-region',
  '.open-table-drawer__scroll',
].join(', ');

const FIELD_ANCHOR_SELECTOR = [
  '.app-shop-datetime-field',
  '.app-shop-date-field',
  '.app-form-field',
  '.login-input-group',
  'app-shop-datetime-input',
  'app-shop-date-input',
].join(', ');

export function appKeyboardOverlapPx(): number {
  const vv = globalThis.visualViewport;
  if (!vv) return 0;
  return Math.max(0, globalThis.innerHeight - vv.height - vv.offsetTop);
}

export function isAppKeyboardLikelyOpen(): boolean {
  return appKeyboardOverlapPx() > APP_KEYBOARD_OVERLAP_THRESHOLD_PX;
}

/** Sync visual viewport metrics to CSS variables on :root. */
export function syncAppKeyboardViewportCssVars(): void {
  const root = document.documentElement;
  const vv = globalThis.visualViewport;

  if (!vv || !isAppMobileViewport()) {
    root.style.removeProperty('--app-keyboard-overlap');
    root.style.removeProperty('--app-visual-viewport-height');
    root.style.removeProperty('--app-visual-viewport-offset-top');
    root.classList.remove('app-keyboard-open');
    return;
  }

  const overlap = appKeyboardOverlapPx();
  root.style.setProperty('--app-keyboard-overlap', `${overlap}px`);
  root.style.setProperty('--app-visual-viewport-height', `${vv.height}px`);
  root.style.setProperty('--app-visual-viewport-offset-top', `${vv.offsetTop}px`);
  root.classList.toggle('app-keyboard-open', overlap > APP_KEYBOARD_OVERLAP_THRESHOLD_PX);
}

function canScrollY(el: HTMLElement): boolean {
  const style = globalThis.getComputedStyle(el);
  const overflowY = style.overflowY;
  if (overflowY !== 'auto' && overflowY !== 'scroll' && overflowY !== 'overlay') {
    return false;
  }
  return el.scrollHeight > el.clientHeight + 1;
}

function findScrollParent(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement;
  let genericCandidate: HTMLElement | null = null;

  while (node && node !== document.documentElement) {
    if (node.matches(APP_SCROLL_CONTAINER_SELECTOR) && canScrollY(node)) {
      return node;
    }
    if (!genericCandidate && canScrollY(node)) {
      genericCandidate = node;
    }
    node = node.parentElement;
  }

  return genericCandidate;
}

function resolveAppFieldScrollAnchor(target: HTMLElement): HTMLElement {
  if (target.classList.contains('app-combobox-search')) {
    const openRoot = document.querySelector('.app-dropdown-root--open');
    if (openRoot instanceof HTMLElement) {
      return openRoot;
    }
  }

  const wrapped = target.closest(FIELD_ANCHOR_SELECTOR);
  if (wrapped instanceof HTMLElement) {
    return wrapped;
  }

  const labelled = target.closest('label');
  if (labelled?.parentElement instanceof HTMLElement) {
    return labelled.parentElement;
  }

  return target;
}

function isAnchorVisibleInVisualViewport(anchor: HTMLElement, margin: number): boolean {
  const vv = globalThis.visualViewport;
  if (!vv) return true;

  const rect = anchor.getBoundingClientRect();
  const visibleTop = vv.offsetTop + margin;
  const visibleBottom = vv.offsetTop + vv.height - margin;
  return rect.top >= visibleTop && rect.bottom <= visibleBottom;
}

function scrollDeltaForAnchor(anchor: HTMLElement, margin: number): number {
  const vv = globalThis.visualViewport;
  if (!vv) return 0;

  const rect = anchor.getBoundingClientRect();
  const visibleTop = vv.offsetTop + margin;
  const visibleBottom = vv.offsetTop + vv.height - margin;
  const visibleHeight = Math.max(0, visibleBottom - visibleTop);
  const keyboardOpen = isAppKeyboardLikelyOpen();
  const idealTop = keyboardOpen
    ? visibleTop + visibleHeight * 0.18
    : visibleTop + visibleHeight * 0.32;

  if (rect.bottom > visibleBottom) {
    return rect.bottom - visibleBottom + 12;
  }
  if (rect.top < visibleTop) {
    return rect.top - visibleTop - 12;
  }
  if (keyboardOpen && rect.top > idealTop + visibleHeight * 0.45) {
    return rect.top - idealTop;
  }
  if (!keyboardOpen && rect.top > idealTop + visibleHeight * 0.55) {
    return rect.top - idealTop;
  }

  return 0;
}

function applyScrollDelta(el: HTMLElement, deltaY: number): boolean {
  if (deltaY === 0) return false;

  const scrollParent = findScrollParent(el);
  if (scrollParent) {
    scrollParent.scrollTop += deltaY;
    return true;
  }

  const scrollingElement = document.scrollingElement;
  if (scrollingElement) {
    scrollingElement.scrollTop += deltaY;
    return true;
  }

  return false;
}

/** Scroll the focused field (and its label/wrapper) into the visible area above the keyboard. */
export function revealAppFieldInVisualViewport(target: HTMLElement): void {
  const vv = globalThis.visualViewport;
  if (!vv || !isAppMobileViewport()) return;
  if (target.closest('.flatpickr-calendar')) return;

  const anchor = resolveAppFieldScrollAnchor(target);
  const margin = 20;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (isAnchorVisibleInVisualViewport(anchor, margin)) {
      return;
    }

    const deltaY = scrollDeltaForAnchor(anchor, margin);
    if (deltaY === 0) {
      return;
    }

    if (!applyScrollDelta(anchor, deltaY)) {
      anchor.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      return;
    }
  }
}

/** Back-compat alias used by existing call sites. */
export function scrollAppFieldIntoVisualViewport(target: HTMLElement): void {
  revealAppFieldInVisualViewport(target);
}

const REVEAL_DELAYS_MS = [0, 120, 280, 450, 650] as const;

/** Run reveal now and after keyboard animation settles (all pages / modals / sheets). */
export function scheduleAppFieldReveal(target: HTMLElement): void {
  if (!isAppMobileViewport()) return;

  const run = (): void => {
    syncAppKeyboardViewportCssVars();
    revealAppFieldInVisualViewport(target);
  };

  run();
  requestAnimationFrame(() => {
    run();
    requestAnimationFrame(run);
  });

  for (const delay of REVEAL_DELAYS_MS) {
    if (delay === 0) continue;
    globalThis.setTimeout(run, delay);
  }
}

export function isAppFocusableField(target: EventTarget | null): target is HTMLElement {
  return (
    target instanceof HTMLElement &&
    typeof target.matches === 'function' &&
    target.matches(FOCUSABLE_FIELD_SELECTOR)
  );
}

export function isAppMobileViewportMediaQuery(): string {
  return APP_MOBILE_MEDIA_QUERY;
}
