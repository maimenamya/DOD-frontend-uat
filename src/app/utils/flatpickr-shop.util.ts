import type flatpickr from 'flatpickr';

type FlatpickrInput = HTMLInputElement & { _flatpickr?: flatpickr.Instance };

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
