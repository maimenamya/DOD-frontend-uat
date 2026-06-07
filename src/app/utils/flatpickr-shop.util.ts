import type flatpickr from 'flatpickr';

type FlatpickrInput = HTMLInputElement & { _flatpickr?: flatpickr.Instance };

const SHOP_FLATPICKR_MOBILE_MQ = '(max-width: 639px)';

export function isShopFlatpickrMobileViewport(): boolean {
  return globalThis.matchMedia(SHOP_FLATPICKR_MOBILE_MQ).matches;
}

/** Bottom-sheet layout on phone; floating position on desktop. */
export function syncShopFlatpickrOnOpen(instance: flatpickr.Instance): void {
  const cal = instance.calendarContainer;
  cal.classList.toggle('app-flatpickr-calendar--mobile', isShopFlatpickrMobileViewport());
  requestAnimationFrame(() => {
    if (isShopFlatpickrMobileViewport()) {
      cal.style.removeProperty('top');
      cal.style.removeProperty('left');
      cal.style.removeProperty('right');
    } else {
      instance._positionCalendar();
    }
  });
}

/** Close any open shop datetime picker; returns true if one was closed. */
export function closeOpenShopFlatpickrCalendars(): boolean {
  let closed = false;
  for (const el of document.querySelectorAll('input.flatpickr-input')) {
    const fp = (el as FlatpickrInput)._flatpickr;
    if (fp?.isOpen) {
      fp.close();
      closed = true;
    }
  }
  return closed;
}
