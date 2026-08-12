import { Component, DestroyRef, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AppKeyboardViewportService } from './services/app-keyboard-viewport.service';
import { ThemeService } from './services/theme.service';
import { installAppToggleScrollFix } from './utils/app-toggle-scroll-fix.util';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
  styleUrl: './app.component.css',
})
export class AppComponent {
  constructor() {
    inject(ThemeService);
    inject(AppKeyboardViewportService);
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(installAppToggleScrollFix());
  }
}
