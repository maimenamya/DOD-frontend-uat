import { Component, computed, input, signal } from '@angular/core';

import {
  APP_BRAND_ICON_SRC,
  isUsableImageUrl,
} from '../../utils/app-placeholder-image.util';

/**
 * Thumbnail that falls back to the D-rink app icon when src is empty or fails to load.
 * Size/shape come from the host `class` on the usage site (so parent CSS applies).
 */
@Component({
  selector: 'app-thumb-image',
  host: {
    class: 'app-thumb-image',
    '[class.app-thumb-image--cover]': 'fit() === "cover"',
    '[class.app-thumb-image--fill-fallback]': 'fillFallback()',
  },
  styles: `
    :host {
      display: flex;
      overflow: hidden;
      flex-shrink: 0;
      background: var(--surface, transparent);
    }
    :host img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: contain;
    }
    :host(.app-thumb-image--cover) img:not(.app-thumb-image--brand) {
      object-fit: cover;
    }
    :host img.app-thumb-image--brand {
      padding: 12%;
      object-fit: contain;
    }
    :host(.app-thumb-image--fill-fallback) {
      display: block;
      width: 100%;
      aspect-ratio: 1;
      overflow: hidden;
    }
    :host(.app-thumb-image--fill-fallback) img.app-thumb-image--brand {
      padding: 0;
      object-fit: cover;
    }
  `,
  template: `
    <img
      [src]="displaySrc()"
      [alt]="alt()"
      [class.app-thumb-image--brand]="isBrandFallback()"
      [attr.loading]="loading()"
      decoding="async"
      (error)="onError()"
    />
  `,
})
export class AppThumbImageComponent {
  readonly src = input<string | null | undefined>(null);
  readonly alt = input('');
  readonly fit = input<'contain' | 'cover'>('contain');
  readonly fillFallback = input(false);
  readonly loading = input<'lazy' | 'eager' | null>('lazy');

  private readonly failedSrc = signal<string | null>(null);

  readonly displaySrc = computed(() => {
    const raw = this.src()?.trim() ?? '';
    if (!isUsableImageUrl(raw) || this.failedSrc() === raw) {
      return APP_BRAND_ICON_SRC;
    }
    return raw;
  });

  readonly isBrandFallback = computed(() => this.displaySrc() === APP_BRAND_ICON_SRC);

  onError(): void {
    const raw = this.src()?.trim() ?? '';
    if (!isUsableImageUrl(raw) || this.failedSrc() === raw) return;
    this.failedSrc.set(raw);
  }
}
