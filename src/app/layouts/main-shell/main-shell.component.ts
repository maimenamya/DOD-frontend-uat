import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AppHeaderComponent } from '../../components/app-header/app-header.component';
import { AppToastComponent } from '../../components/app-toast/app-toast.component';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';

@Component({
  selector: 'app-main-shell',
  imports: [RouterOutlet, SidebarComponent, AppHeaderComponent, AppToastComponent],
  templateUrl: './main-shell.component.html',
})
export class MainShellComponent {
  readonly mobileMenuOpen = signal(false);

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }
}
