import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { ServicePickupPageComponent } from '../service-pickup/service-pickup-page.component';
import { StationQueuePageComponent } from '../station-queue/station-queue-page.component';
import { AuthService } from '../../services/auth.service';
import {
  STATION_WORK_TAB_LABEL,
  stationWorkTabsForUser,
  type StationWorkTab,
} from '../../models/work-duty';

@Component({
  selector: 'app-station-work-page',
  imports: [StationQueuePageComponent, ServicePickupPageComponent],
  templateUrl: './station-work-page.component.html',
})
export class StationWorkPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  readonly tabLabels = STATION_WORK_TAB_LABEL;
  readonly tabs = computed(() => stationWorkTabsForUser(this.auth.getUser()));
  readonly activeTab = signal<StationWorkTab>('food');
  readonly showTabs = computed(() => this.tabs().length > 1);

  readonly activeTabLabel = computed(() => STATION_WORK_TAB_LABEL[this.activeTab()]);

  ngOnInit(): void {
    this.syncTabFromRoute();
    this.route.paramMap.subscribe(() => this.syncTabFromRoute());
  }

  selectTab(tab: StationWorkTab): void {
    if (!this.tabs().includes(tab) || tab === this.activeTab()) return;
    void this.router.navigate(['/dashboard/station-work', tab]);
  }

  private syncTabFromRoute(): void {
    const available = this.tabs();
    if (available.length === 0) return;

    const fromRoute = this.route.snapshot.paramMap.get('tab');
    const parsed =
      fromRoute === 'food' || fromRoute === 'drink' || fromRoute === 'pickup'
        ? fromRoute
        : null;

    const next =
      parsed && available.includes(parsed) ? parsed : available[0];
    this.activeTab.set(next);

    if (fromRoute !== next) {
      void this.router.navigate(['/dashboard/station-work', next], { replaceUrl: true });
    }
  }
}
