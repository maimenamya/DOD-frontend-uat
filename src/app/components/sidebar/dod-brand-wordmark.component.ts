import { Component } from '@angular/core';

/** Sidebar brand — neon DODs wordmark. */
@Component({
  selector: 'app-dod-brand-wordmark',
  standalone: true,
  host: {
    class: 'app-sidebar-brand-wordmark',
    'aria-label': 'DODs',
  },
  template: `DODs`,
})
export class DodBrandWordmarkComponent {}
