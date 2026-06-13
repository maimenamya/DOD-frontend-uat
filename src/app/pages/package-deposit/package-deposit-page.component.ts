import { DecimalPipe } from '@angular/common';
import { Component, signal } from '@angular/core';

import type { PackageDepositRecord } from '../../models/package-deposit';

@Component({
  selector: 'app-package-deposit-page',
  imports: [DecimalPipe],
  templateUrl: './package-deposit-page.component.html',
})
export class PackageDepositPageComponent {
  /** รอ API — ตอนนี้แสดงโครงตารางอย่างเดียว */
  readonly items = signal<PackageDepositRecord[]>([]);

  packageSourceLabel(type: PackageDepositRecord['packageSourceType']): string {
    return type === 'MEMBERSHIP' ? 'เมม' : 'โปร';
  }
}
