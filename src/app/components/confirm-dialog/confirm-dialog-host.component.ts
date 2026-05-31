import { Component, inject } from '@angular/core';

import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ConfirmDialogComponent } from './confirm-dialog.component';

@Component({
  selector: 'app-confirm-dialog-host',
  imports: [ConfirmDialogComponent],
  template: `
    <app-confirm-dialog
      [open]="confirm.open()"
      [title]="confirm.title()"
      [message]="confirm.message()"
      [confirmLabel]="confirm.confirmLabel()"
      [cancelLabel]="confirm.cancelLabel()"
      [busy]="confirm.busy()"
      (confirm)="confirm.onConfirm()"
      (cancel)="confirm.onCancel()"
    />
  `,
})
export class ConfirmDialogHostComponent {
  readonly confirm = inject(ConfirmDialogService);
}
