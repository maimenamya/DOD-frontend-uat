import { Component, inject, output } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  templateUrl: './app-header.component.html',
})
export class AppHeaderComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly menuToggle = output<void>();

  readonly user = this.auth.getUser();

  onMenuClick(): void {
    this.menuToggle.emit();
  }

  goToProfile(): void {
    void this.router.navigate(['/dashboard/my-profile']);
  }
}
