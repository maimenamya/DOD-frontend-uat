import { Component, OnInit, inject, signal } from '@angular/core';

import type { PackageDepositRecord } from '../../models/package-deposit';
import { PackageDepositService } from '../../services/package-deposit.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-package-deposit-page',
  imports: [],
  templateUrl: './package-deposit-page.component.html',
})
export class PackageDepositPageComponent implements OnInit {
  private readonly packageDeposits = inject(PackageDepositService);
  private readonly toast = inject(ToastService);

  readonly items = signal<PackageDepositRecord[]>([]);
  readonly loading = signal(true);

  ngOnInit(): void {
    this.loadItems();
  }

  loadItems(): void {
    this.loading.set(true);
    this.packageDeposits.list().subscribe({
      next: (rows) => {
        this.items.set(rows);
        this.loading.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'ไม่สามารถโหลดรายการฝากได้');
        this.loading.set(false);
      },
    });
  }

  packageSourceLabel(type: PackageDepositRecord['sourceType']): string {
    return type === 'MEMBERSHIP' ? 'เมม' : 'โปร';
  }
}
