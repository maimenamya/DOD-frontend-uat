import { Component, inject } from '@angular/core';

import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  templateUrl: './app-toast.component.html',
})
export class AppToastComponent {
  readonly toast = inject(ToastService);
  readonly dismissMs = ToastService.AUTO_DISMISS_MS;

  dismiss(): void {
    this.toast.dismiss();
  }

  onProgressEnd(event: AnimationEvent): void {
    if (event.animationName !== 'app-toast-progress-run') {
      return;
    }
    this.dismiss();
  }
}
