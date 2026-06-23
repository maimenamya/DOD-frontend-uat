import { DestroyRef, Injectable, inject } from '@angular/core';

import {
  isAppFocusableField,
  isAppMobileViewportMediaQuery,
  revealAppFieldInVisualViewport,
  scheduleAppFieldReveal,
  syncAppKeyboardViewportCssVars,
} from '../utils/app-keyboard-viewport.util';
import { isAppMobileViewport } from '../utils/app-viewport.util';

/** Mobile: track visualViewport + scroll focused fields above the on-screen keyboard. */
@Injectable({ providedIn: 'root' })
export class AppKeyboardViewportService {
  private readonly destroyRef = inject(DestroyRef);
  private attached = false;
  private activeField: HTMLElement | null = null;
  private clearActiveFieldTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly onViewportChange = (): void => {
    syncAppKeyboardViewportCssVars();
    const field = this.activeField;
    if (!field) return;
    revealAppFieldInVisualViewport(field);
    requestAnimationFrame(() => {
      if (this.activeField === field) {
        revealAppFieldInVisualViewport(field);
      }
    });
  };

  private readonly onFocusIn = (event: FocusEvent): void => {
    const target = event.target;
    if (!isAppFocusableField(target)) return;

    if (this.clearActiveFieldTimer) {
      globalThis.clearTimeout(this.clearActiveFieldTimer);
      this.clearActiveFieldTimer = null;
    }

    this.activeField = target;
    scheduleAppFieldReveal(target);
  };

  private readonly onFocusOut = (): void => {
    if (this.clearActiveFieldTimer) {
      globalThis.clearTimeout(this.clearActiveFieldTimer);
    }
    this.clearActiveFieldTimer = globalThis.setTimeout(() => {
      this.activeField = null;
      this.clearActiveFieldTimer = null;
    }, 120);
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    const target = event.target;
    if (!isAppFocusableField(target)) return;
    this.activeField = target;
    scheduleAppFieldReveal(target);
  };

  constructor() {
    if (typeof window === 'undefined') return;

    this.syncStandaloneClass();
    this.bindIfMobile();

    const mq = window.matchMedia(isAppMobileViewportMediaQuery());
    const onMqChange = (): void => {
      this.unbind();
      this.bindIfMobile();
    };
    mq.addEventListener('change', onMqChange);
    this.destroyRef.onDestroy(() => {
      mq.removeEventListener('change', onMqChange);
      this.unbind();
      if (this.clearActiveFieldTimer) {
        globalThis.clearTimeout(this.clearActiveFieldTimer);
      }
    });
  }

  private bindIfMobile(): void {
    if (!isAppMobileViewport() || this.attached) return;

    const vv = globalThis.visualViewport;
    vv?.addEventListener('resize', this.onViewportChange);
    vv?.addEventListener('scroll', this.onViewportChange);
    document.addEventListener('focusin', this.onFocusIn, true);
    document.addEventListener('focusout', this.onFocusOut, true);
    document.addEventListener('pointerdown', this.onPointerDown, true);
    syncAppKeyboardViewportCssVars();
    this.attached = true;
  }

  private unbind(): void {
    if (!this.attached) return;

    const vv = globalThis.visualViewport;
    vv?.removeEventListener('resize', this.onViewportChange);
    vv?.removeEventListener('scroll', this.onViewportChange);
    document.removeEventListener('focusin', this.onFocusIn, true);
    document.removeEventListener('focusout', this.onFocusOut, true);
    document.removeEventListener('pointerdown', this.onPointerDown, true);
    this.activeField = null;
    syncAppKeyboardViewportCssVars();
    this.attached = false;
  }

  private syncStandaloneClass(): void {
    const root = document.documentElement;
    const standaloneMq = window.matchMedia('(display-mode: standalone)');
    const apply = (): void => {
      root.classList.toggle('app-standalone', standaloneMq.matches);
    };
    apply();
    standaloneMq.addEventListener('change', apply);
    this.destroyRef.onDestroy(() => standaloneMq.removeEventListener('change', apply));
  }
}
