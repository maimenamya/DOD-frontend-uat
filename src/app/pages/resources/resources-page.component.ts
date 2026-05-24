import { Component, OnInit, computed, inject, signal } from '@angular/core';
import type { Beverage } from '../../models/beverage';
import { BeverageService } from '../../services/beverage.service';

@Component({
  selector: 'app-resources-page',
  templateUrl: './resources-page.component.html',
})
export class ResourcesPageComponent implements OnInit {
  private readonly beverageService = inject(BeverageService);

  readonly beverages = signal<Beverage[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly total = computed(() => this.beverages().length);

  ngOnInit(): void {
    this.beverageService.getBeverages().subscribe({
      next: (data) => {
        this.beverages.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('ไม่สามารถโหลดข้อมูลเครื่องดื่มเมนูได้');
        this.loading.set(false);
      },
    });
  }
}
