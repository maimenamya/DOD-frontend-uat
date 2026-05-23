import { Component, OnInit, computed, inject, signal } from '@angular/core';
import type { ResourceItem } from '../../models/resource';
import { ResourceService } from '../../services/resource.service';

@Component({
  selector: 'app-resources-page',
  templateUrl: './resources-page.component.html',
})
export class ResourcesPageComponent implements OnInit {
  private readonly resourceService = inject(ResourceService);

  readonly resources = signal<ResourceItem[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly total = computed(() => this.resources().length);

  ngOnInit(): void {
    this.resourceService.getResources().subscribe({
      next: (data) => {
        this.resources.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('ไม่สามารถโหลดข้อมูลทรัพยากรได้');
        this.loading.set(false);
      },
    });
  }
}

