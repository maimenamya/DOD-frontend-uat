import { Component, input, output } from '@angular/core';

import { closeOpenShopFlatpickrCalendars } from '../../utils/flatpickr-shop.util';

export type AppModalLayout = 'center' | 'sheet';

@Component({
  selector: 'app-modal',
  templateUrl: './app-modal.component.html',
  host: {
    '[class.app-modal-host--sheet]': 'layout() === "sheet"',
    '[class.app-modal-host--center]': 'layout() === "center"',
  },
})
export class AppModalComponent {
  readonly closeOnBackdrop = input(true);
  /** `sheet` = bottom sheet on small screens; `center` = master CRUD dialog. */
  readonly layout = input<AppModalLayout>('center');
  readonly dismiss = output<void>();

  /** First backdrop tap closes datetime picker only; second tap closes modal. */
  private closedFlatpickrOnBackdrop = false;

  onBackdropPointerDown(event: PointerEvent): void {
    this.closedFlatpickrOnBackdrop = false;
    if (!this.closeOnBackdrop() || event.target !== event.currentTarget) {
      return;
    }
    if (closeOpenShopFlatpickrCalendars()) {
      this.closedFlatpickrOnBackdrop = true;
      event.preventDefault();
      event.stopPropagation();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (!this.closeOnBackdrop() || event.target !== event.currentTarget) {
      return;
    }
    if (this.closedFlatpickrOnBackdrop) {
      this.closedFlatpickrOnBackdrop = false;
      return;
    }
    if (closeOpenShopFlatpickrCalendars()) {
      return;
    }
    this.dismiss.emit();
  }

  onBackdropEscape(): void {
    if (!this.closeOnBackdrop()) {
      return;
    }
    if (closeOpenShopFlatpickrCalendars()) {
      return;
    }
    this.dismiss.emit();
  }
}
