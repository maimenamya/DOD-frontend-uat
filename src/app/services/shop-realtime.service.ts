import { Injectable, NgZone, inject, effect, signal } from '@angular/core';
import { io, type Socket } from 'socket.io-client';
import { Subject } from 'rxjs';

import { environment } from '../../environments/environment';
import { trimTrailingSlashes } from '../utils/trim-slashes.util';
import { AuthService } from './auth.service';

/** Keep in sync with backend `REALTIME_EVENTS`. */
export const SHOP_REALTIME_EVENTS = {
  floorPlanUpdated: 'floor-plan-updated',
  sessionUpdated: 'session-updated',
} as const;

export type FloorPlanUpdatedEvent = {
  shopId: number;
  reason: string;
  seatingId?: number;
  sessionId?: number;
};

export type SessionUpdatedEvent = {
  shopId: number;
  sessionId: number;
  revision?: number;
  reason?: string;
  sessionClosed?: boolean;
};

/**
 * Shop-scoped Socket.io client.
 * Server joins `shop:{shopId}` from JWT — clients only listen and refresh UI.
 *
 * Exposes {@link isConnected} so open-table can fall back to faster polling when live push is down.
 */
@Injectable({ providedIn: 'root' })
export class ShopRealtimeService {
  private readonly auth = inject(AuthService);
  private readonly ngZone = inject(NgZone);

  private socket: Socket | null = null;
  private connectedToken: string | null = null;

  private readonly connectedSignal = signal(false);
  /** True while the socket has an active connection (not merely “trying”). */
  readonly isConnected = this.connectedSignal.asReadonly();

  private readonly floorPlanUpdatedSubject = new Subject<FloorPlanUpdatedEvent>();
  private readonly sessionUpdatedSubject = new Subject<SessionUpdatedEvent>();
  private readonly connectionChangedSubject = new Subject<boolean>();

  readonly floorPlanUpdated$ = this.floorPlanUpdatedSubject.asObservable();
  readonly sessionUpdated$ = this.sessionUpdatedSubject.asObservable();
  /** Emits whenever live connectivity flips (including intentional disconnect). */
  readonly connectionChanged$ = this.connectionChangedSubject.asObservable();

  constructor() {
    effect(() => {
      const session = this.auth.session();
      const token = session?.token ?? null;
      if (!token || session?.user.shopId == null) {
        this.disconnect();
        return;
      }
      this.connect(token);
    });
  }

  private setConnected(live: boolean): void {
    if (this.connectedSignal() === live) return;
    this.connectedSignal.set(live);
    this.connectionChangedSubject.next(live);
  }

  private connect(token: string): void {
    if (this.socket && this.connectedToken === token) return;

    this.disconnect();

    const origin = socketOriginFromApiUrl(environment.apiUrl);
    const opts = {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'] as ('websocket' | 'polling')[],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
      timeout: 8_000,
      withCredentials: true,
    };

    this.socket = origin ? io(origin, opts) : io(opts);
    this.connectedToken = token;

    this.socket.on('connect', () => {
      this.ngZone.run(() => this.setConnected(true));
    });
    this.socket.on('disconnect', () => {
      this.ngZone.run(() => this.setConnected(false));
    });
    this.socket.on('connect_error', (err) => {
      if (this.socket?.connected) return;
      this.ngZone.run(() => this.setConnected(false));
      console.warn('[realtime] connect_error', err.message);
    });
    this.socket.on(SHOP_REALTIME_EVENTS.floorPlanUpdated, (payload: FloorPlanUpdatedEvent) => {
      this.ngZone.run(() => this.floorPlanUpdatedSubject.next(normalizeFloorPlanEvent(payload)));
    });
    this.socket.on(SHOP_REALTIME_EVENTS.sessionUpdated, (payload: SessionUpdatedEvent) => {
      this.ngZone.run(() => this.sessionUpdatedSubject.next(normalizeSessionEvent(payload)));
    });
  }

  private disconnect(): void {
    if (!this.socket) {
      this.connectedToken = null;
      this.setConnected(false);
      return;
    }
    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.socket = null;
    this.connectedToken = null;
    this.setConnected(false);
  }
}

/** Absolute API → backend origin; relative `/api` → same origin (dev proxy). */
export function socketOriginFromApiUrl(apiUrl: string): string | undefined {
  const trimmed = trimTrailingSlashes(apiUrl.trim());
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed.replace(/\/api$/i, '') || undefined;
  }
  return undefined;
}

function optionalPositiveInt(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

function normalizeFloorPlanEvent(payload: FloorPlanUpdatedEvent): FloorPlanUpdatedEvent {
  return {
    ...payload,
    shopId: Number(payload?.shopId),
    seatingId: optionalPositiveInt(payload?.seatingId),
    sessionId: optionalPositiveInt(payload?.sessionId),
  };
}

function normalizeSessionEvent(payload: SessionUpdatedEvent): SessionUpdatedEvent {
  return {
    ...payload,
    shopId: Number(payload?.shopId),
    sessionId: Number(payload?.sessionId),
    revision: optionalPositiveInt(payload?.revision),
    sessionClosed: payload?.sessionClosed === true,
  };
}
