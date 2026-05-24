import { Component, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { ResourceService } from '../../services/resource.service';
import type { ResourceItem } from '../../models/resource';

@Component({
  selector: 'app-master-drink-page',
  imports: [DecimalPipe],
  templateUrl: './master-drink-page.component.html',
})
export class MasterDrinkPageComponent implements OnInit {
  private readonly resourceService = inject(ResourceService);

  readonly drinks = signal<ResourceItem[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.resourceService.getResources().subscribe({
      next: (items) => {
        this.drinks.set(items);
        this.loading.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.error.set(err.error?.error ?? 'ไม่สามารถโหลดข้อมูลเครื่องดื่มได้');
        this.loading.set(false);
      },
    });
  }

  commissionPercent(rate: number): string {
    return `${(rate * 100).toFixed(0)}%`;
  }
}
