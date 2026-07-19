import { Component } from '@angular/core';

/** Sidebar brand — D-rink wordmark (gold→purple gradient). */
@Component({
  selector: 'app-dod-brand-wordmark',
  standalone: true,
  host: {
    class: 'app-sidebar-brand-wordmark',
    'aria-label': 'D-rink',
  },
  template: `D-rink`,
})
export class DodBrandWordmarkComponent {}
