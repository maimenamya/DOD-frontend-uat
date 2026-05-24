import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-modal',
  templateUrl: './app-modal.component.html',
})
export class AppModalComponent {
  readonly closeOnBackdrop = input(true);
  readonly dismiss = output<void>();

  onBackdropClick(): void {
    if (this.closeOnBackdrop()) {
      this.dismiss.emit();
    }
  }
}
