import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AppKeyboardViewportService } from './services/app-keyboard-viewport.service';
import { ThemeService } from './services/theme.service';

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
  }
}
