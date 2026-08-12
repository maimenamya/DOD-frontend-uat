/**
 * Stops modal/sheet scroll "warping" when clicking `.app-toggle`.
 * Browsers scrollIntoView the focused checkbox inside overflow containers;
 * pointer toggles should not move the scroll position.
 */
export function installAppToggleScrollFix(): () => void {
  if (typeof document === 'undefined') {
    return () => undefined;
  }

  let pointerOnToggle = false;
  let savedScrollTop = 0;
  let savedScrollEl: HTMLElement | null = null;

  const nearestScrollParent = (el: HTMLElement): HTMLElement | null => {
    let node: HTMLElement | null = el.parentElement;
    while (node) {
      const { overflowY } = getComputedStyle(node);
      if (
        (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
        node.scrollHeight > node.clientHeight + 1
      ) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  };

  const onPointerDown = (event: PointerEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const toggle = target.closest('.app-toggle');
    if (!toggle) {
      pointerOnToggle = false;
      return;
    }
    pointerOnToggle = true;
    const scroll = nearestScrollParent(toggle as HTMLElement);
    savedScrollEl = scroll;
    savedScrollTop = scroll?.scrollTop ?? 0;
    // Clicking the input itself: block focus (click still toggles checked).
    if (target instanceof HTMLInputElement && target.classList.contains('app-toggle-input')) {
      event.preventDefault();
    }
  };

  const restoreScroll = (): void => {
    if (savedScrollEl) {
      savedScrollEl.scrollTop = savedScrollTop;
    }
  };

  const onFocusIn = (event: FocusEvent): void => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.classList.contains('app-toggle-input')) {
      return;
    }
    const scroll = nearestScrollParent(target) ?? savedScrollEl;
    if (scroll) {
      const top = savedScrollEl === scroll ? savedScrollTop : scroll.scrollTop;
      scroll.scrollTop = top;
      requestAnimationFrame(() => {
        scroll.scrollTop = top;
        requestAnimationFrame(() => {
          scroll.scrollTop = top;
        });
      });
    }
    // Pointer click: drop focus so the sheet never keeps chasing the checkbox.
    if (pointerOnToggle) {
      target.blur();
      restoreScroll();
    }
  };

  const onPointerEnd = (): void => {
    if (!pointerOnToggle) {
      return;
    }
    restoreScroll();
    requestAnimationFrame(restoreScroll);
    pointerOnToggle = false;
  };

  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('focusin', onFocusIn, true);
  document.addEventListener('pointerup', onPointerEnd, true);
  document.addEventListener('pointercancel', onPointerEnd, true);

  return () => {
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('focusin', onFocusIn, true);
    document.removeEventListener('pointerup', onPointerEnd, true);
    document.removeEventListener('pointercancel', onPointerEnd, true);
  };
}
