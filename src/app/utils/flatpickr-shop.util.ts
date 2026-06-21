import type flatpickr from 'flatpickr';

type FlatpickrInput = HTMLInputElement & { _flatpickr?: flatpickr.Instance };

import { APP_MOBILE_MEDIA_QUERY } from './app-viewport.util';

const SHOP_FLATPICKR_MOBILE_MQ = APP_MOBILE_MEDIA_QUERY;
const SHOP_FLATPICKR_MOBILE_SCRIM_CLASS = 'app-flatpickr-mobile-scrim';
const SHOP_FLATPICKR_MOBILE_BODY_CLASS = 'app-flatpickr-mobile-open';

export function isShopFlatpickrMobileViewport(): boolean {
  return globalThis.matchMedia(SHOP_FLATPICKR_MOBILE_MQ).matches;
}

/** Dim backdrop behind phone bottom-sheet picker; tap scrim to dismiss. */
export function openShopFlatpickrMobileChrome(instance: flatpickr.Instance): void {
  if (!isShopFlatpickrMobileViewport()) return;
  closeShopFlatpickrMobileChrome();
  const scrim = document.createElement('button');
  scrim.type = 'button';
  scrim.className = SHOP_FLATPICKR_MOBILE_SCRIM_CLASS;
  scrim.setAttribute('aria-label', 'ปิดตัวเลือกวันที่');
  scrim.addEventListener('click', () => instance.close());
  document.body.appendChild(scrim);
  document.body.classList.add(SHOP_FLATPICKR_MOBILE_BODY_CLASS);
}

export function closeShopFlatpickrMobileChrome(): void {
  document.querySelector(`.${SHOP_FLATPICKR_MOBILE_SCRIM_CLASS}`)?.remove();
  document.body.classList.remove(SHOP_FLATPICKR_MOBILE_BODY_CLASS);
}

/** Bottom-sheet layout on phone; floating position on desktop. */
export function syncShopFlatpickrOnOpen(instance: flatpickr.Instance): void {
  const cal = instance.calendarContainer;
  const mobile = isShopFlatpickrMobileViewport();
  cal.classList.toggle('app-flatpickr-calendar--mobile', mobile);
  if (mobile) {
    openShopFlatpickrMobileChrome(instance);
  } else {
    closeShopFlatpickrMobileChrome();
  }
  requestAnimationFrame(() => {
    if (mobile) {
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
  if (closed) {
    closeShopFlatpickrMobileChrome();
  }
  return closed;
}
