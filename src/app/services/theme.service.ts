import { Injectable, signal } from '@angular/core';

export type UiTheme = 'dark';

const STORAGE_KEY = 'dod-ui-theme';

/** Applies dark theme only — no UI toggle (bar POS). */
@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  readonly theme = signal<UiTheme>('dark');

  constructor() {
    this.apply('dark');
    try {
      localStorage.setItem(STORAGE_KEY, 'dark');
    } catch {
      /* private mode / quota */
    }
  }

  private apply(theme: UiTheme): void {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    document.body.classList.add('dark-theme');
  }
}
