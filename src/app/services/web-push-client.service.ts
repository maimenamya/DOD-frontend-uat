import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { ApiConfig } from '../core/api-config';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

@Injectable({
  providedIn: 'root',
})
export class WebPushClientService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);
  private ensureInFlight: Promise<boolean> | null = null;

  /** Register SW + request permission + save subscription (idempotent). */
  ensureSubscribed(): Promise<boolean> {
    if (this.ensureInFlight) return this.ensureInFlight;
    this.ensureInFlight = this.runEnsure().finally(() => {
      this.ensureInFlight = null;
    });
    return this.ensureInFlight;
  }

  private async runEnsure(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return false;
    }
    if (!window.isSecureContext) {
      return false;
    }

    try {
      const meta = await firstValueFrom(
        this.http.get<{ configured: boolean; publicKey: string | null }>(
          this.api.resource('notifications/push/vapid-public-key'),
        ),
      );
      if (!meta.configured || !meta.publicKey) {
        return false;
      }

      const registration = await navigator.serviceWorker.register('/push-sw.js', {
        scope: '/',
      });
      await navigator.serviceWorker.ready;

      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }
      if (permission !== 'granted') {
        return false;
      }

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(meta.publicKey) as BufferSource,
        });
      }

      const json = subscription.toJSON();
      const p256dh = json.keys?.['p256dh'];
      const auth = json.keys?.['auth'];
      if (!json.endpoint || !p256dh || !auth) {
        return false;
      }

      await firstValueFrom(
        this.http.post(this.api.resource('notifications/push/subscribe'), {
          endpoint: json.endpoint,
          keys: {
            p256dh,
            auth,
          },
        }),
      );
      return true;
    } catch (error) {
      console.warn('[web-push] ensureSubscribed failed', error);
      return false;
    }
  }
}
