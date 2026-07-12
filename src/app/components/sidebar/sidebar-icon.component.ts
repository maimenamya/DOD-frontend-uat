import { Component, input } from '@angular/core';

export type SidebarIconName =
  | 'dashboard'
  | 'open-table'
  | 'tag'
  | 'employees'
  | 'drinks'
  | 'food'
  | 'seatings'
  | 'marketing'
  | 'receipt'
  | 'history'
  | 'more'
  | 'report'
  | 'package'
  | 'stock'
  | 'shop-rules'
  | 'logout'
  | 'help'
  | 'chevron-down'
  | 'chevron-right'
  | 'attendance'
  | 'drink-payout'
  | 'bell';

@Component({
  selector: 'app-sidebar-icon',
  standalone: true,
  host: {
    class: 'app-sidebar-icon',
  },
  template: `
    <svg
      class="app-sidebar-icon-svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      @switch (name()) {
        @case ('dashboard') {
          <rect x="3" y="3" width="8" height="10" rx="1.5" />
          <rect x="13" y="3" width="8" height="5" rx="1.5" />
          <rect x="3" y="16" width="8" height="5" rx="1.5" />
          <rect x="13" y="11" width="8" height="10" rx="1.5" />
        }
        @case ('open-table') {
          <!-- round pedestal table -->
          <ellipse cx="12" cy="7.5" rx="7.5" ry="2.5" />
          <path d="M12 10v6.5" />
          <ellipse cx="12" cy="18.75" rx="4.25" ry="1.35" />
        }
        @case ('tag') {
          <path
            d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"
          />
          <circle cx="7.5" cy="7.5" r="1" />
        }
        @case ('employees') {
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        }
        @case ('drinks') {
          <path d="M8 22h8" />
          <path d="M7 10h10" />
          <path d="M12 15v7" />
          <path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z" />
        }
        @case ('food') {
          <!-- cloche (food cover), no knob — fills viewBox -->
          <path d="M4.5 16.5C4.5 7.5 19.5 7.5 19.5 16.5" />
          <path d="M3.5 18h17" />
          <path d="M4 20h16" />
        }
        @case ('seatings') {
          <!-- armchair (same as former open-table) -->
          <path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3" />
          <path d="M3 11v2a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4v-2" />
          <path d="M5 11V9" />
          <path d="M19 11V9" />
          <path d="M7 15v4" />
          <path d="M17 15v4" />
        }
        @case ('marketing') {
          <rect x="3" y="8" width="18" height="4" rx="1" />
          <path d="M12 8v13" />
          <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
          <path
            d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"
          />
        }
        @case ('receipt') {
          <!-- receipt: folded top-left, torn zigzag bottom, three text lines -->
          <path
            d="M6 4h2v2h10v14l-1.5 1.5L15 20l-1.5 1.5L12 20l-1.5 1.5L9 20l-1.5 1.5L6 20V6V4z"
          />
          <path d="M9 10h7" />
          <path d="M9 13h7" />
          <path d="M13 16h3" />
        }
        @case ('history') {
          <!-- open folder archive — past bills (distinct from attendance clock and package box) -->
          <path d="M4 8h5l2 2h9a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z" />
          <path d="M11 10H4" />
          <path d="M8 13.5h8" />
          <path d="M8 16.5h8" />
          <path d="M8 19.5h5.5" />
        }
        @case ('more') {
          <circle cx="5" cy="12" r="1.75" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.75" fill="currentColor" stroke="none" />
          <circle cx="19" cy="12" r="1.75" fill="currentColor" stroke="none" />
        }
        @case ('package') {
          <path
            d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"
          />
          <path d="M12 22V12" />
          <path d="m3.3 7 7.7 4 7.7-4" />
          <path d="m7.5 4.27 9 5.15" />
        }
        @case ('stock') {
          <!-- คลังสินค้า: warehouse roof + walls + stacked boxes -->
          <path d="M3 11 12 5l9 6" />
          <path d="M5 11v9" />
          <path d="M19 11v9" />
          <path d="M5 20h14" />
          <rect x="7" y="13" width="4" height="3" rx="0.75" />
          <rect x="13" y="13" width="4" height="3" rx="0.75" />
          <rect x="9" y="17" width="6" height="2.5" rx="0.75" />
        }
        @case ('shop-rules') {
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        }
        @case ('report') {
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
          <path d="M14 2v6h6" />
          <path d="M16 13H8" />
          <path d="M16 17H8" />
          <path d="M10 9H8" />
        }
        @case ('logout') {
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="m16 17 5-5-5-5" />
          <path d="M21 12H9" />
        }
        @case ('help') {
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <path d="M12 17h.01" />
        }
        @case ('chevron-down') {
          <path d="m6 9 6 6 6-6" />
        }
        @case ('chevron-right') {
          <path d="m9 18 6-6-6-6" />
        }
        @case ('attendance') {
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        }
        @case ('drink-payout') {
          <!-- slanted banknote -->
          <g transform="translate(12 12) rotate(-14) translate(-12 -12)">
            <rect x="4.5" y="7" width="15" height="10" rx="1.5" />
            <circle cx="12" cy="12" r="2.5" />
            <path d="M7.5 10h2" />
            <path d="M14.5 14h2" />
          </g>
        }
        @case ('bell') {
          <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5" />
          <path d="M9.5 17a2.5 2.5 0 0 0 5 0" />
        }
      }
    </svg>
  `,
})
export class SidebarIconComponent {
  readonly name = input.required<SidebarIconName>();
}
