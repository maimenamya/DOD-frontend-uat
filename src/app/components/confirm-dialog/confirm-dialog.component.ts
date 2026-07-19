import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AppModalComponent } from '../app-modal/app-modal.component';

@Component({
  selector: 'app-confirm-dialog',
  imports: [AppModalComponent, FormsModule],
  templateUrl: './confirm-dialog.component.html',
})
export class ConfirmDialogComponent {
  readonly open = input(false);
  readonly title = input('ยืนยัน');
  readonly message = input('');
  readonly confirmLabel = input('ยืนยัน');
  readonly cancelLabel = input('ยกเลิก');
  readonly busy = input(false);
  readonly requiresReason = input(false);
  readonly reasonLabel = input('เหตุผลการแก้ไข/ลบ');
  readonly reasonPlaceholder = input('ระบุเหตุผลอย่างน้อย 3 ตัวอักษร');
  readonly reasonText = input('');
  readonly reasonValidated = input(false);

  readonly confirm = output<void>();
  readonly cancel = output<void>();
  readonly reasonTextChange = output<string>();
}
