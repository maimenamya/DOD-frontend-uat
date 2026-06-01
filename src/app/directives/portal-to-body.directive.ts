import {
  Directive,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
} from '@angular/core';

import { portalElementToBody } from '../utils/body-portal.util';

/** Portals host element to `document.body` on create; restores on destroy. */
@Directive({
  selector: '[appPortalToBody]',
  standalone: true,
})
export class PortalToBodyDirective {
  /** Optional `document.body` class for scroll lock while portaled. */
  readonly bodyLockClass = input<string | null>(null);

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);
  private restorePortal: (() => void) | null = null;

  constructor() {
    afterNextRender(() => {
      this.restorePortal = portalElementToBody(this.el.nativeElement);
      const lockClass = this.bodyLockClass();
      if (lockClass) {
        document.body.classList.add(lockClass);
      }
    });
    this.destroyRef.onDestroy(() => {
      this.restorePortal?.();
      this.restorePortal = null;
      const lockClass = this.bodyLockClass();
      if (lockClass) {
        document.body.classList.remove(lockClass);
      }
    });
  }
}
