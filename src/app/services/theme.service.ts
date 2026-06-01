import { Injectable, signal } from '@angular/core';

export type UiTheme = 'light' | 'dark';

const STORAGE_KEY = 'dod-ui-theme';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  readonly theme = signal<UiTheme>(ThemeService.readStored());

  constructor() {
    this.apply(this.theme());
  }

  toggle(): void {
    this.setTheme(this.theme() === 'dark' ? 'light' : 'dark');
  }

  setTheme(theme: UiTheme): void {
    this.theme.set(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* private mode / quota */
    }
    this.apply(theme);
  }

  private apply(theme: UiTheme): void {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    document.body.classList.toggle('dark-theme', theme === 'dark');
  }

  private static readStored(): UiTheme {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
    } catch {
      /* SSR / private mode */
    }
    return 'dark';
  }
}
