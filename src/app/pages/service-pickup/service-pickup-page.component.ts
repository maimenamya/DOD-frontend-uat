import { Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';

import {
  STATION_TICKET_KIND_LABEL,
  type StationTicket,
} from '../../models/station-ticket';
import { StationTicketService } from '../../services/station-ticket.service';
import { ToastService } from '../../services/toast.service';

const POLL_MS = 15_000;

@Component({
  selector: 'app-service-pickup-page',
  templateUrl: './service-pickup-page.component.html',
})
export class ServicePickupPageComponent implements OnInit {
  private readonly stationTickets = inject(StationTicketService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly embedded = input(false);

  readonly tickets = signal<StationTicket[]>([]);
  readonly loading = signal(true);
  readonly actingId = signal<number | null>(null);
  readonly kindLabel = STATION_TICKET_KIND_LABEL;

  ngOnInit(): void {
    this.load();
    this.startPolling();
  }

  markPickedUp(ticket: StationTicket): void {
    if (this.actingId() != null) return;
    this.actingId.set(ticket.id);
    this.stationTickets.markPickedUp(ticket.id).subscribe({
      next: () => {
        this.actingId.set(null);
        this.toast.showSuccess('บันทึกรับของแล้ว');
        this.load();
      },
      error: (err: { error?: { error?: string } }) => {
        this.actingId.set(null);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถบันทึกการรับของได้');
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.stationTickets.listService().subscribe({
      next: (rows) => {
        this.tickets.set(rows);
        this.loading.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.loading.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถโหลดคิวรับของได้');
      },
    });
  }

  private startPolling(): void {
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible' || this.actingId() != null) return;
      this.stationTickets.listService().subscribe({
        next: (rows) => this.tickets.set(rows),
      });
    }, POLL_MS);

    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') {
        this.load();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    this.destroyRef.onDestroy(() => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    });
  }
}
