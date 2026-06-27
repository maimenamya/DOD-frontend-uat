import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { APP_MODAL_BODY_LOCK_CLASS, portalElementToBody } from '../../utils/body-portal.util';
import { APP_MOBILE_MEDIA_QUERY, isAppMobileViewport } from '../../utils/app-viewport.util';
import { closeOpenShopFlatpickrCalendars } from '../../utils/flatpickr-shop.util';

export type AppModalLayout = 'center' | 'sheet';

@Component({
  selector: 'app-modal',
  templateUrl: './app-modal.component.html',
  host: {
    '[class.app-modal-host--sheet]': 'resolvedLayout() === "sheet"',
    '[class.app-modal-host--center]': 'resolvedLayout() === "center"',
    '[class.app-modal-host--mobile-fullscreen]': 'mobileFullscreenActive()',
    '[class.app-modal-host--wide]': 'modalWide()',
    '[class.app-modal-host--elevated]': 'pinCenterOnMobile()',
  },
})
export class AppModalComponent {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);
  private restorePortal: (() => void) | null = null;

  readonly closeOnBackdrop = input(true);
  /** Desktop layout preference — viewports below 1000px default to bottom sheet. */
  readonly layout = input<AppModalLayout>('center');
  /**
   * Opt-in: full viewport on mobile only (e.g. attendance roster detail).
   * Other modals keep default center/sheet behavior.
   */
  readonly mobileFullscreen = input(false);
  /** Keep centered modal on mobile (confirm dialogs). */
  readonly pinCenterOnMobile = input(false);
  readonly dismiss = output<void>();

  private readonly mobileViewport = signal(isAppMobileViewport());

  readonly resolvedLayout = computed((): AppModalLayout => {
    if (this.pinCenterOnMobile()) {
      return 'center';
    }
    if (this.mobileFullscreen() && this.mobileViewport()) {
      return 'center';
    }
    if (this.mobileViewport()) {
      return 'sheet';
    }
    return this.layout();
  });

  readonly mobileFullscreenActive = computed(
    () => this.mobileFullscreen() && this.mobileViewport(),
  );

  readonly modalWide = computed(
    () => this.mobileFullscreen() && !this.mobileViewport(),
  );

  /** First backdrop tap closes datetime picker only; second tap closes modal. */
  private closedFlatpickrOnBackdrop = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const mq = window.matchMedia(APP_MOBILE_MEDIA_QUERY);
      const onChange = (): void => this.mobileViewport.set(mq.matches);
      mq.addEventListener('change', onChange);
      this.destroyRef.onDestroy(() => mq.removeEventListener('change', onChange));
    }
    afterNextRender(() => {
      this.restorePortal = portalElementToBody(this.hostEl.nativeElement);
      document.body.classList.add(APP_MODAL_BODY_LOCK_CLASS);
    });
    this.destroyRef.onDestroy(() => {
      this.restorePortal?.();
      this.restorePortal = null;
      document.body.classList.remove(APP_MODAL_BODY_LOCK_CLASS);
    });
  }

  onBackdropPointerDown(event: PointerEvent): void {
    this.closedFlatpickrOnBackdrop = false;
    if (!this.closeOnBackdrop() || event.target !== event.currentTarget) {
      return;
    }
    if (closeOpenShopFlatpickrCalendars()) {
      this.closedFlatpickrOnBackdrop = true;
      event.preventDefault();
      event.stopPropagation();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (!this.closeOnBackdrop() || event.target !== event.currentTarget) {
      return;
    }
    if (this.closedFlatpickrOnBackdrop) {
      this.closedFlatpickrOnBackdrop = false;
      return;
    }
    if (closeOpenShopFlatpickrCalendars()) {
      return;
    }
    this.dismiss.emit();
  }

  onBackdropEscape(): void {
    if (!this.closeOnBackdrop()) {
      return;
    }
    if (closeOpenShopFlatpickrCalendars()) {
      return;
    }
    this.dismiss.emit();
  }
}
