import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-print-icon-button',
  styles: [':host { display: contents; }'],
  template: `
    <button
      type="button"
      class="app-modal-print-btn"
      [disabled]="disabled()"
      [attr.aria-label]="label()"
      [attr.title]="label()"
      (click)="pressed.emit()"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.75"
          d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"
        />
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.75"
          d="M6 14h12v8H6z"
        />
      </svg>
    </button>
  `,
})
export class PrintIconButtonComponent {
  readonly disabled = input(false);
  readonly label = input('พิมพ์บิล');
  readonly pressed = output<void>();
}
