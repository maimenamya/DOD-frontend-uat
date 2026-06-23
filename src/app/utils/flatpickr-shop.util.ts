import type flatpickr from 'flatpickr';
import type { Hook } from 'flatpickr/dist/types/options';
import confirmDatePlugin from 'flatpickr/dist/plugins/confirmDate/confirmDate';

type FlatpickrInput = HTMLInputElement & { _flatpickr?: flatpickr.Instance };

import { APP_MOBILE_MEDIA_QUERY } from './app-viewport.util';
import {
  currentDatetimeLocalValue,
  isValidShopDatetimeLocal,
  splitShopDatetimeLocal,
} from '../pages/open-table/open-table-ledger.util';

/** confirmDate plugin — day/time pick does not close until user taps ยืนยัน. */
export function shopFlatpickrConfirmDatePlugins(): ReturnType<typeof confirmDatePlugin>[] {
  return [
    confirmDatePlugin({
      showAlways: true,
      confirmText: 'ยืนยัน',
      confirmIcon: '',
      theme: 'darkTheme',
    }),
  ];
}

/** Mark confirm before flatpickr plugin calls close(). */
export function bindShopFlatpickrConfirmButton(
  instance: flatpickr.Instance,
  onConfirm: () => void,
): () => void {
  const confirmEl = instance.calendarContainer.querySelector('.flatpickr-confirm');
  if (!confirmEl) return () => {};
  const handler = (): void => onConfirm();
  confirmEl.addEventListener('click', handler, { capture: true });
  return () => confirmEl.removeEventListener('click', handler, { capture: true });
}

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
  unwatchShopFlatpickrKeyboardOverlap();
  document.querySelector(`.${SHOP_FLATPICKR_MOBILE_SCRIM_CLASS}`)?.remove();
  document.body.classList.remove(SHOP_FLATPICKR_MOBILE_BODY_CLASS);
}

function applyShopFlatpickrMobileSheetLayout(instance: flatpickr.Instance): void {
  const cal = instance.calendarContainer;
  cal.style.setProperty('position', 'fixed', 'important');
  cal.style.setProperty('left', '0', 'important');
  cal.style.setProperty('right', '0', 'important');
  cal.style.setProperty('bottom', '0', 'important');
  cal.style.setProperty('top', 'auto', 'important');
  cal.style.setProperty('width', '100%', 'important');
  cal.style.setProperty('max-width', '100%', 'important');
  cal.style.setProperty('margin', '0', 'important');
  cal.style.setProperty('transform', 'none', 'important');
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Read hour/minute fields and apply to flatpickr selection (without closing). */
export function applyShopFlatpickrTimeFromInputs(instance: flatpickr.Instance): void {
  const hourEl = instance.hourElement;
  const minuteEl = instance.minuteElement;
  if (!hourEl || !minuteEl) return;

  const hours = (parseInt(hourEl.value.slice(-2), 10) || 0) % 24;
  const minutes = (parseInt(minuteEl.value, 10) || 0) % 60;
  hourEl.value = pad2(hours);
  minuteEl.value = pad2(minutes);

  const base = instance.selectedDates[0] ?? new Date();
  const next = new Date(base.getTime());
  next.setHours(hours, minutes, 0, 0);
  instance.setDate(next, true);
}

type ShopFlatpickrTimeConfirmHooks = {
  onTimeApplied: () => void;
};

/**
 * Enter in time fields applies typed value but keeps picker open until ยืนยัน.
 * Hour → minute; minute → dismiss keyboard and show ยืนยัน (flatpickr default Enter closes).
 */
export function bindShopFlatpickrTimeInputsWithConfirm(
  instance: flatpickr.Instance,
  hooks: ShopFlatpickrTimeConfirmHooks,
): () => void {
  const hour = instance.hourElement;
  const minute = instance.minuteElement;
  if (!hour || !minute) return () => {};

  hour.setAttribute('inputmode', 'numeric');
  hour.setAttribute('enterkeyhint', 'next');
  minute.setAttribute('inputmode', 'numeric');
  minute.setAttribute('enterkeyhint', 'done');

  const onTimeKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    event.stopImmediatePropagation();

    applyShopFlatpickrTimeFromInputs(instance);
    hooks.onTimeApplied();

    if (event.target === hour) {
      minute.focus();
      minute.select();
      return;
    }
    if (event.target === minute) {
      minute.blur();
      instance.calendarContainer.querySelector('.flatpickr-confirm')?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  };

  const onTimeBlur = (): void => {
    applyShopFlatpickrTimeFromInputs(instance);
    hooks.onTimeApplied();
  };

  hour.addEventListener('keydown', onTimeKeyDown, { capture: true });
  minute.addEventListener('keydown', onTimeKeyDown, { capture: true });
  hour.addEventListener('blur', onTimeBlur);
  minute.addEventListener('blur', onTimeBlur);

  return () => {
    hour.removeEventListener('keydown', onTimeKeyDown, { capture: true });
    minute.removeEventListener('keydown', onTimeKeyDown, { capture: true });
    hour.removeEventListener('blur', onTimeBlur);
    minute.removeEventListener('blur', onTimeBlur);
  };
}

/** Blur time/year inputs so iOS does not show keyboard after picking a day. */
export function blurShopFlatpickrTypingFocus(instance: flatpickr.Instance): void {
  instance.hourElement?.blur();
  instance.minuteElement?.blur();
  instance.currentYearElement?.blur();
  const active = document.activeElement;
  if (active instanceof HTMLElement && instance.calendarContainer.contains(active)) {
    if (active.classList.contains('numInput') || active.classList.contains('cur-year')) {
      active.blur();
    }
  }
}

/**
 * On phone: keyboard only when user taps hour/minute directly — not after selecting a calendar day
 * (flatpickr auto-focuses hourElement on day tap).
 */
export function setupShopFlatpickrMobileKeyboardGuard(instance: flatpickr.Instance): () => void {
  const cleanups: (() => void)[] = [];
  let userTappedTimeField = false;

  const year = instance.currentYearElement;
  if (year) {
    year.setAttribute('readonly', 'true');
    year.setAttribute('inputmode', 'none');
    const onYearFocus = (): void => {
      if (!isShopFlatpickrMobileViewport()) return;
      year.blur();
    };
    year.addEventListener('focus', onYearFocus);
    cleanups.push(() => year.removeEventListener('focus', onYearFocus));
  }

  const timeContainer = instance.timeContainer;
  const onTimePointerDown = (event: PointerEvent): void => {
    if (!isShopFlatpickrMobileViewport()) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const hour = instance.hourElement;
    const minute = instance.minuteElement;
    if (
      target === hour ||
      target === minute ||
      target.closest('.numInputWrapper') === hour?.parentElement ||
      target.closest('.numInputWrapper') === minute?.parentElement
    ) {
      userTappedTimeField = true;
    }
  };
  timeContainer?.addEventListener('pointerdown', onTimePointerDown, { capture: true });
  cleanups.push(() =>
    timeContainer?.removeEventListener('pointerdown', onTimePointerDown, { capture: true }),
  );

  const guardInput = (input: HTMLInputElement): void => {
    const onFocus = (): void => {
      if (!isShopFlatpickrMobileViewport()) return;
      if (userTappedTimeField) {
        userTappedTimeField = false;
        return;
      }
      globalThis.setTimeout(() => input.blur(), 0);
    };
    input.addEventListener('focus', onFocus);
    cleanups.push(() => input.removeEventListener('focus', onFocus));
  };

  if (instance.hourElement) guardInput(instance.hourElement);
  if (instance.minuteElement) guardInput(instance.minuteElement);

  return () => cleanups.forEach((fn) => fn());
}

let keyboardOverlapCleanup: (() => void) | null = null;

/** Lift bottom sheet above iOS/Android on-screen keyboard so time fields stay visible. */
export function watchShopFlatpickrKeyboardOverlap(instance: flatpickr.Instance): void {
  unwatchShopFlatpickrKeyboardOverlap();
  if (!isShopFlatpickrMobileViewport()) return;

  const cal = instance.calendarContainer;
  const vv = globalThis.visualViewport;

  const apply = (): void => {
    if (!instance.isOpen) return;
    applyShopFlatpickrMobileSheetLayout(instance);
    if (!vv) return;

    const overlap = Math.max(0, globalThis.innerHeight - vv.height - vv.offsetTop);
    if (overlap > 60) {
      cal.style.setProperty('bottom', `${overlap}px`, 'important');
      cal.style.setProperty('max-height', `${Math.max(220, vv.height - 12)}px`, 'important');
      cal.classList.add('app-flatpickr-calendar--keyboard');
      instance.timeContainer?.scrollIntoView({ block: 'end', behavior: 'smooth' });
    } else {
      cal.classList.remove('app-flatpickr-calendar--keyboard');
    }
  };

  const onFocus = (): void => {
    apply();
    requestAnimationFrame(apply);
    globalThis.setTimeout(apply, 120);
  };

  vv?.addEventListener('resize', apply);
  vv?.addEventListener('scroll', apply);
  instance.hourElement?.addEventListener('focus', onFocus);
  instance.minuteElement?.addEventListener('focus', onFocus);

  keyboardOverlapCleanup = () => {
    vv?.removeEventListener('resize', apply);
    vv?.removeEventListener('scroll', apply);
    instance.hourElement?.removeEventListener('focus', onFocus);
    instance.minuteElement?.removeEventListener('focus', onFocus);
    cal.classList.remove('app-flatpickr-calendar--keyboard');
  };
}

export function unwatchShopFlatpickrKeyboardOverlap(): void {
  keyboardOverlapCleanup?.();
  keyboardOverlapCleanup = null;
}

const SHOP_FLATPICKR_TIME_WHEEL_ITEM_PX_FALLBACK = 44;
const SHOP_FLATPICKR_TIME_NUDGE_MINUTES = [5, 15] as const;

type ShopFlatpickrTimeWheelHooks = {
  onTimeApplied: () => void;
  /** Wall-clock `YYYY-MM-DDTHH:mm` — calendar day + default time when opening wheels. */
  shopDatetime?: string;
};

let timeWheelsCleanup: (() => void) | null = null;

function shopFlatpickrPad2(n: number): string {
  return String(n).padStart(2, '0');
}

function shopFlatpickrWheelItemPx(scrollEl: HTMLElement): number {
  const item = scrollEl.querySelector<HTMLElement>('.app-time-wheel-item');
  const height = item?.getBoundingClientRect().height ?? 0;
  return height > 0 ? height : SHOP_FLATPICKR_TIME_WHEEL_ITEM_PX_FALLBACK;
}

function shopFlatpickrReadWheelValue(scrollEl: HTMLElement, max: number): number {
  const itemPx = shopFlatpickrWheelItemPx(scrollEl);
  const index = Math.round(scrollEl.scrollTop / itemPx);
  return Math.max(0, Math.min(max - 1, index));
}

function shopFlatpickrScrollWheelTo(scrollEl: HTMLElement, value: number): void {
  scrollEl.scrollTop = value * shopFlatpickrWheelItemPx(scrollEl);
}

function shopFlatpickrUpdateWheelSelection(scrollEl: HTMLElement, selected: number): void {
  const items = scrollEl.querySelectorAll<HTMLButtonElement>('.app-time-wheel-item');
  items.forEach((item, index) => {
    item.classList.toggle('app-time-wheel-item--selected', index === selected);
    item.setAttribute('aria-selected', index === selected ? 'true' : 'false');
  });
}

function shopFlatpickrApplyTimeFromWheels(
  instance: flatpickr.Instance,
  hourScroll: HTMLElement,
  minuteScroll: HTMLElement,
  hooks: ShopFlatpickrTimeWheelHooks,
): void {
  const hours = shopFlatpickrReadWheelValue(hourScroll, 24);
  const minutes = shopFlatpickrReadWheelValue(minuteScroll, 60);
  shopFlatpickrUpdateWheelSelection(hourScroll, hours);
  shopFlatpickrUpdateWheelSelection(minuteScroll, minutes);

  shopFlatpickrApplyWallClockTime(instance, hours, minutes, hooks, true);
}

function shopFlatpickrCreateTimeWheel(
  part: 'hour' | 'minute',
  max: number,
  selected: number,
  instance: flatpickr.Instance,
  hooks: ShopFlatpickrTimeWheelHooks,
  peerScroll: () => HTMLElement,
): HTMLElement {
  const root = document.createElement('div');
  root.className = 'app-time-wheel';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', part === 'hour' ? 'ชั่วโมง' : 'นาที');

  const highlight = document.createElement('div');
  highlight.className = 'app-time-wheel-highlight';
  highlight.setAttribute('aria-hidden', 'true');

  const scroll = document.createElement('div');
  scroll.className = 'app-time-wheel-scroll';
  scroll.setAttribute('role', 'listbox');
  scroll.tabIndex = 0;

  const topSpacer = document.createElement('div');
  topSpacer.className = 'app-time-wheel-spacer';
  topSpacer.setAttribute('aria-hidden', 'true');
  scroll.appendChild(topSpacer);

  for (let value = 0; value < max; value += 1) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'app-time-wheel-item';
    item.setAttribute('role', 'option');
    item.dataset['value'] = String(value);
    item.textContent = shopFlatpickrPad2(value);
    item.addEventListener('click', () => {
      shopFlatpickrScrollWheelTo(scroll, value);
      shopFlatpickrApplyTimeFromWheels(instance, part === 'hour' ? scroll : peerScroll(), part === 'minute' ? scroll : peerScroll(), hooks);
    });
    scroll.appendChild(item);
  }

  const bottomSpacer = document.createElement('div');
  bottomSpacer.className = 'app-time-wheel-spacer';
  bottomSpacer.setAttribute('aria-hidden', 'true');
  scroll.appendChild(bottomSpacer);

  root.appendChild(highlight);
  root.appendChild(scroll);
  shopFlatpickrUpdateWheelSelection(scroll, selected);

  let scrollTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
  const onScroll = (): void => {
    if (scrollTimer) globalThis.clearTimeout(scrollTimer);
    scrollTimer = globalThis.setTimeout(() => {
      shopFlatpickrApplyTimeFromWheels(instance, part === 'hour' ? scroll : peerScroll(), part === 'minute' ? scroll : peerScroll(), hooks);
    }, 80);
  };
  scroll.addEventListener('scroll', onScroll, { passive: true });

  root.dataset['wheelPart'] = part;
  return root;
}

function shopFlatpickrResolveWheelDatePart(
  instance: flatpickr.Instance,
  shopDatetime?: string,
): string {
  if (shopDatetime?.trim() && isValidShopDatetimeLocal(shopDatetime)) {
    return splitShopDatetimeLocal(shopDatetime).datePart;
  }
  const selected = instance.selectedDates[0];
  if (selected) {
    const display = instance.formatDate(selected, 'Y-m-d');
    if (/^\d{4}-\d{2}-\d{2}$/.test(display)) {
      return display;
    }
  }
  return splitShopDatetimeLocal(currentDatetimeLocalValue()).datePart;
}

function shopFlatpickrApplyWallClockTime(
  instance: flatpickr.Instance,
  hours: number,
  minutes: number,
  hooks: ShopFlatpickrTimeWheelHooks,
  triggerChange: boolean,
): void {
  const datePart = shopFlatpickrResolveWheelDatePart(instance, hooks.shopDatetime);
  instance.setDate(`${datePart} ${pad2(hours)}:${pad2(minutes)}`, triggerChange);
  hooks.onTimeApplied();
}

function shopFlatpickrWheelInitialShopDatetime(
  instance: flatpickr.Instance,
  hooks: ShopFlatpickrTimeWheelHooks,
): string {
  const fromHook = hooks.shopDatetime?.trim() ?? '';
  if (isValidShopDatetimeLocal(fromHook)) {
    return fromHook;
  }
  const selected = instance.selectedDates[0];
  if (selected) {
    const display = instance.formatDate(selected, 'Y-m-d H:i');
    const match = /^(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2})/.exec(display);
    if (match) {
      return `${match[1]}T${match[2]}:${match[3]}`;
    }
  }
  return currentDatetimeLocalValue();
}

function shopFlatpickrWheelInitialTime(
  instance: flatpickr.Instance,
  hooks: ShopFlatpickrTimeWheelHooks,
): { hour: number; minute: number } {
  const parts = splitShopDatetimeLocal(shopFlatpickrWheelInitialShopDatetime(instance, hooks));
  const hours = Math.min(23, Math.max(0, parseInt(parts.hour, 10) || 0));
  const minutes = Math.min(59, Math.max(0, parseInt(parts.minute, 10) || 0));
  shopFlatpickrApplyWallClockTime(instance, hours, minutes, hooks, false);
  return { hour: hours, minute: minutes };
}

function shopFlatpickrPositionTimeWheels(
  hourScroll: HTMLElement,
  hour: number,
  minuteScroll: HTMLElement,
  minute: number,
): void {
  const apply = (): void => {
    shopFlatpickrScrollWheelTo(hourScroll, hour);
    shopFlatpickrScrollWheelTo(minuteScroll, minute);
    shopFlatpickrUpdateWheelSelection(hourScroll, hour);
    shopFlatpickrUpdateWheelSelection(minuteScroll, minute);
  };
  apply();
  requestAnimationFrame(() => {
    apply();
    requestAnimationFrame(apply);
  });
}

function shopFlatpickrNudgeTimeByMinutes(
  instance: flatpickr.Instance,
  hourScroll: HTMLElement,
  minuteScroll: HTMLElement,
  hooks: ShopFlatpickrTimeWheelHooks,
  deltaMinutes: number,
): void {
  const hours = shopFlatpickrReadWheelValue(hourScroll, 24);
  const minutes = shopFlatpickrReadWheelValue(minuteScroll, 60);
  const maxTotal = 23 * 60 + 59;
  const total = Math.max(0, Math.min(maxTotal, hours * 60 + minutes + deltaMinutes));
  const newHour = Math.floor(total / 60);
  const newMinute = total % 60;
  shopFlatpickrPositionTimeWheels(hourScroll, newHour, minuteScroll, newMinute);
  shopFlatpickrApplyTimeFromWheels(instance, hourScroll, minuteScroll, hooks);
}

function shopFlatpickrCreateTimeNudgeButtons(
  instance: flatpickr.Instance,
  hourScroll: HTMLElement,
  minuteScroll: HTMLElement,
  hooks: ShopFlatpickrTimeWheelHooks,
  side: 'minus' | 'plus',
): HTMLElement {
  const root = document.createElement('div');
  root.className = `app-flatpickr-time-nudge app-flatpickr-time-nudge--${side}`;

  for (const amount of SHOP_FLATPICKR_TIME_NUDGE_MINUTES) {
    const delta = side === 'plus' ? amount : -amount;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'app-flatpickr-time-nudge-btn';
    btn.textContent = side === 'plus' ? `+${amount}` : `-${amount}`;
    btn.setAttribute(
      'aria-label',
      side === 'plus' ? `เพิ่ม ${amount} นาที` : `ลด ${amount} นาที`,
    );
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      shopFlatpickrNudgeTimeByMinutes(instance, hourScroll, minuteScroll, hooks, delta);
    });
    root.appendChild(btn);
  }

  return root;
}

/** Mobile: scroll wheels for hour/minute — no keyboard, tap row or scroll then ยืนยัน. */
export function mountShopFlatpickrMobileTimeWheels(
  instance: flatpickr.Instance,
  hooks: ShopFlatpickrTimeWheelHooks,
): () => void {
  unmountShopFlatpickrMobileTimeWheels();
  if (!isShopFlatpickrMobileViewport() || !instance.config.enableTime) return () => {};

  const timeContainer = instance.timeContainer;
  if (!timeContainer) return () => {};

  const { hour, minute } = shopFlatpickrWheelInitialTime(instance, hooks);

  timeContainer.classList.add('app-flatpickr-time--wheel');

  const wheelsRoot = document.createElement('div');
  wheelsRoot.className = 'app-flatpickr-time-wheels';

  let hourScroll!: HTMLElement;
  let minuteScroll!: HTMLElement;

  const hourWheel = shopFlatpickrCreateTimeWheel('hour', 24, hour, instance, hooks, () => minuteScroll);
  hourScroll = hourWheel.querySelector('.app-time-wheel-scroll') as HTMLElement;

  const sep = document.createElement('span');
  sep.className = 'app-flatpickr-time-wheels-sep';
  sep.setAttribute('aria-hidden', 'true');
  sep.textContent = ':';

  const minuteWheel = shopFlatpickrCreateTimeWheel('minute', 60, minute, instance, hooks, () => hourScroll);
  minuteScroll = minuteWheel.querySelector('.app-time-wheel-scroll') as HTMLElement;

  const nudgeMinus = shopFlatpickrCreateTimeNudgeButtons(
    instance,
    hourScroll,
    minuteScroll,
    hooks,
    'minus',
  );
  const nudgePlus = shopFlatpickrCreateTimeNudgeButtons(
    instance,
    hourScroll,
    minuteScroll,
    hooks,
    'plus',
  );

  wheelsRoot.append(nudgeMinus, hourWheel, sep, minuteWheel, nudgePlus);
  timeContainer.appendChild(wheelsRoot);
  shopFlatpickrPositionTimeWheels(hourScroll, hour, minuteScroll, minute);

  timeWheelsCleanup = () => {
    wheelsRoot.remove();
    timeContainer.classList.remove('app-flatpickr-time--wheel');
    timeWheelsCleanup = null;
  };

  return timeWheelsCleanup;
}

export function unmountShopFlatpickrMobileTimeWheels(): void {
  timeWheelsCleanup?.();
  timeWheelsCleanup = null;
}

function clearShopFlatpickrMobileSheetLayout(instance: flatpickr.Instance): void {
  const cal = instance.calendarContainer;
  for (const prop of ['position', 'left', 'right', 'bottom', 'top', 'width', 'max-width', 'margin', 'transform']) {
    cal.style.removeProperty(prop);
  }
}

/** Remove mobile scrim/sheet chrome when picker closes or component destroys. */
export function syncShopFlatpickrOnClose(instance: flatpickr.Instance): void {
  unmountShopFlatpickrMobileTimeWheels();
  closeShopFlatpickrMobileChrome();
  clearShopFlatpickrMobileSheetLayout(instance);
  instance.calendarContainer.classList.remove('app-flatpickr-calendar--mobile');
}

type ShopFlatpickrCloseHooked = flatpickr.Instance & { __shopCloseHook?: boolean };

function callShopFlatpickrHooks(
  hooks: Hook | Hook[] | undefined,
  selectedDates: Date[],
  dateStr: string,
  fp: flatpickr.Instance,
): void {
  if (!hooks) return;
  const list = Array.isArray(hooks) ? hooks : [hooks];
  for (const hook of list) {
    hook(selectedDates, dateStr, fp);
  }
}

/** Chain util cleanup before component onClose so scrim never sticks on phone. */
function ensureShopFlatpickrCloseCleanupHook(instance: flatpickr.Instance): void {
  const tagged = instance as ShopFlatpickrCloseHooked;
  if (tagged.__shopCloseHook) return;
  tagged.__shopCloseHook = true;
  const userOnClose = instance.config.onClose;
  const wrapped: Hook = (selectedDates, dateStr, fp) => {
    syncShopFlatpickrOnClose(fp);
    callShopFlatpickrHooks(userOnClose, selectedDates, dateStr, fp);
  };
  instance.set('onClose', wrapped);
}

/** Bottom-sheet layout on phone; floating position on desktop. */
export function syncShopFlatpickrOnOpen(instance: flatpickr.Instance): void {
  ensureShopFlatpickrCloseCleanupHook(instance);
  const cal = instance.calendarContainer;
  const mobile = isShopFlatpickrMobileViewport();
  cal.classList.toggle('app-flatpickr-calendar--mobile', mobile);
  if (mobile) {
    openShopFlatpickrMobileChrome(instance);
    applyShopFlatpickrMobileSheetLayout(instance);
    // Flatpickr re-applies floating coords after open — pin full-width sheet again.
    requestAnimationFrame(() => applyShopFlatpickrMobileSheetLayout(instance));
    globalThis.setTimeout(() => applyShopFlatpickrMobileSheetLayout(instance), 0);
  } else {
    closeShopFlatpickrMobileChrome();
    clearShopFlatpickrMobileSheetLayout(instance);
    requestAnimationFrame(() => instance._positionCalendar());
  }
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
