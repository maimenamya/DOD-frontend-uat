import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import {
  STATION_TICKET_KIND_LABEL,
  STATION_TICKET_STATUS_LABEL,
  type StationTicket,
  type StationTicketKind,
} from '../../models/station-ticket';
import { StationTicketService } from '../../services/station-ticket.service';
import { ToastService } from '../../services/toast.service';

const POLL_MS = 15_000;

@Component({
  selector: 'app-station-queue-page',
  templateUrl: './station-queue-page.component.html',
})
export class StationQueuePageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly stationTickets = inject(StationTicketService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly embedded = input(false);
  readonly kindInput = input<StationTicketKind | undefined>(undefined, { alias: 'kind' });

  readonly kind = signal<StationTicketKind>('FOOD');
  readonly tickets = signal<StationTicket[]>([]);
  readonly loading = signal(true);
  readonly actingId = signal<number | null>(null);

  readonly pageTitle = computed(() =>
    this.kind() === 'FOOD' ? 'คิวครัว' : 'คิวบาร์น้ำ',
  );
  readonly kindLabel = computed(() => STATION_TICKET_KIND_LABEL[this.kind()]);
  readonly pendingTickets = computed(() =>
    this.tickets().filter((ticket) => ticket.status === 'PENDING'),
  );
  readonly readyTickets = computed(() =>
    this.tickets().filter((ticket) => ticket.status === 'READY'),
  );
  readonly statusLabel = STATION_TICKET_STATUS_LABEL;

  ngOnInit(): void {
    const fromInput = this.kindInput();
    if (fromInput === 'FOOD' || fromInput === 'DRINK') {
      this.kind.set(fromInput);
    } else {
      const dataKind = this.route.snapshot.data['kind'] as StationTicketKind | undefined;
      if (dataKind === 'FOOD' || dataKind === 'DRINK') {
        this.kind.set(dataKind);
      }
    }
    this.load();
    this.startPolling();
  }

  markReady(ticket: StationTicket): void {
    if (this.actingId() != null) return;
    this.actingId.set(ticket.id);
    this.stationTickets.markReady(ticket.id).subscribe({
      next: () => {
        this.actingId.set(null);
        this.toast.showSuccess('บันทึกพร้อมเสิร์ฟแล้ว');
        this.load();
      },
      error: (err: { error?: { error?: string } }) => {
        this.actingId.set(null);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถอัปเดตคิวได้');
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.stationTickets.listPrep(this.kind()).subscribe({
      next: (rows) => {
        this.tickets.set(rows);
        this.loading.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.loading.set(false);
        this.toast.showError(err.error?.error ?? 'ไม่สามารถโหลดคิวได้');
      },
    });
  }

  private startPolling(): void {
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible' || this.actingId() != null) return;
      this.stationTickets.listPrep(this.kind()).subscribe({
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
