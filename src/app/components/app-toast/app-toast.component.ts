import { Component, inject } from '@angular/core';

import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  templateUrl: './app-toast.component.html',
})
export class AppToastComponent {
  readonly toast = inject(ToastService);

  dismiss(): void {
    this.toast.dismiss();
  }
}
