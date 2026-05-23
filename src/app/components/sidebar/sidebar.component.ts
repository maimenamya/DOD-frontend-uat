import { Component, inject, input, output } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly mobileOpen = input(false);
  readonly mobileClose = output<void>();

  readonly user = this.auth.getUser();
  readonly showTeamLinks = this.auth.canAccessTeamManagement();
  readonly showManagersLink = this.auth.isOwner();

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
