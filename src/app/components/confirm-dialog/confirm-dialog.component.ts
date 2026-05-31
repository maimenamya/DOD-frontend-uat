import { Component, input, output } from '@angular/core';

import { AppModalComponent } from '../app-modal/app-modal.component';

@Component({
  selector: 'app-confirm-dialog',
  imports: [AppModalComponent],
  templateUrl: './confirm-dialog.component.html',
})
export class ConfirmDialogComponent {
  readonly open = input(false);
  readonly title = input('ยืนยัน');
  readonly message = input('');
  readonly confirmLabel = input('ยืนยัน');
  readonly cancelLabel = input('ยกเลิก');
  readonly busy = input(false);

  readonly confirm = output<void>();
  readonly cancel = output<void>();
}
