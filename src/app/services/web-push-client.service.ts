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

export type WebPushStatus =
  | 'ready'
  | 'unsupported'
  | 'insecure'
  | 'ios_need_homescreen'
  | 'server_disabled'
  | 'denied'
  | 'need_permission'
  | 'error';

export type WebPushEnsureResult = {
  ok: boolean;
  status: WebPushStatus;
  message: string;
};

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return iOS || iPadOs;
}

function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const displayStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const displayFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
  const iosStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return displayStandalone || displayFullscreen || iosStandalone;
}

function isChromeOnIos(): boolean {
  return typeof navigator !== 'undefined' && /CriOS/i.test(navigator.userAgent);
}

function iosLaunchModeLabel(): string {
  if (isStandalonePwa()) return 'เปิดแบบแอป';
  if (isChromeOnIos()) return 'เปิดใน Chrome';
  return 'เปิดแบบแท็บเบราว์เซอร์';
}

function iosPushUnsupportedMessage(standalone: boolean): string {
  const mode = iosLaunchModeLabel();
  if (!standalone) {
    return (
      `ตอนนี้: ${mode} (ยังไม่ใช่โหมดแอป) — ใช้ Safari เท่านั้น → แชร์ → เพิ่มไปยังหน้าโฮม ` +
      `แล้วเปิดจากไอคอน (ไม่ต้องสนคำว่า Delete Bookmark) · ตั้งค่า → Safari เป็นเบราว์เซอร์เริ่มต้น`
    );
  }
  return (
    `ตอนนี้: ${mode} แต่เครื่องยังไม่มี Push — ต้อง iOS 16.4+ · ลบไอคอนโฮม ล้างข้อมูลเว็บ Safari แล้วเพิ่มใหม่จาก Safari`
  );
}

@Injectable({
  providedIn: 'root',
})
export class WebPushClientService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);
  private ensureInFlight: Promise<WebPushEnsureResult> | null = null;

  /**
   * Register SW + save subscription.
   * Pass `requestPermission: true` only from a user tap (required on iPhone).
   */
  ensureSubscribed(options?: { requestPermission?: boolean }): Promise<WebPushEnsureResult> {
    if (this.ensureInFlight) return this.ensureInFlight;
    this.ensureInFlight = this.runEnsure(Boolean(options?.requestPermission)).finally(() => {
      this.ensureInFlight = null;
    });
    return this.ensureInFlight;
  }

  async getStatusHint(): Promise<WebPushEnsureResult> {
    if (typeof window === 'undefined') {
      return { ok: false, status: 'unsupported', message: 'ไม่รองรับบนอุปกรณ์นี้' };
    }
    if (!window.isSecureContext) {
      return { ok: false, status: 'insecure', message: 'ต้องเปิดผ่าน HTTPS' };
    }
    // iPhone: PushManager is missing in a normal Safari/Chrome tab — check this before "unsupported".
    if (isIosDevice() && !isStandalonePwa()) {
      return {
        ok: false,
        status: 'ios_need_homescreen',
        message: iosPushUnsupportedMessage(false),
      };
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return {
        ok: false,
        status: 'unsupported',
        message: isIosDevice()
          ? iosPushUnsupportedMessage(isStandalonePwa())
          : 'เบราว์เซอร์นี้ไม่รองรับแจ้งเตือนเครื่อง',
      };
    }
    if (Notification.permission === 'granted') {
      return this.ensureSubscribed({ requestPermission: false });
    }
    if (Notification.permission === 'denied') {
      return {
        ok: false,
        status: 'denied',
        message: 'เครื่องปิดการแจ้งเตือนไว้ — เปิดได้ที่ตั้งค่า iPhone → การแจ้งเตือน',
      };
    }
    return {
      ok: false,
      status: 'need_permission',
      message: 'กดปุ่มด้านล่างเพื่อเปิดแจ้งเตือนดังที่เครื่อง',
    };
  }

  private async runEnsure(requestPermission: boolean): Promise<WebPushEnsureResult> {
    if (typeof window === 'undefined') {
      return { ok: false, status: 'unsupported', message: 'ไม่รองรับบนอุปกรณ์นี้' };
    }
    if (!window.isSecureContext) {
      return { ok: false, status: 'insecure', message: 'ต้องเปิดผ่าน HTTPS' };
    }
    if (isIosDevice() && !isStandalonePwa()) {
      return {
        ok: false,
        status: 'ios_need_homescreen',
        message: iosPushUnsupportedMessage(false),
      };
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return {
        ok: false,
        status: 'unsupported',
        message: isIosDevice()
          ? iosPushUnsupportedMessage(isStandalonePwa())
          : 'เบราว์เซอร์นี้ไม่รองรับแจ้งเตือนเครื่อง',
      };
    }

    try {
      const meta = await firstValueFrom(
        this.http.get<{ configured: boolean; publicKey: string | null }>(
          this.api.resource('notifications/push/vapid-public-key'),
        ),
      );
      if (!meta.configured || !meta.publicKey) {
        return {
          ok: false,
          status: 'server_disabled',
          message: 'เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า Web Push',
        };
      }

      const registration = await navigator.serviceWorker.register('/push-sw.js', {
        scope: '/',
      });
      await navigator.serviceWorker.ready;

      let permission = Notification.permission;
      if (permission === 'default') {
        if (!requestPermission) {
          return {
            ok: false,
            status: 'need_permission',
            message: 'กดปุ่มด้านล่างเพื่อเปิดแจ้งเตือนดังที่เครื่อง',
          };
        }
        permission = await Notification.requestPermission();
      }
      if (permission !== 'granted') {
        return {
          ok: false,
          status: 'denied',
          message: 'ยังไม่อนุญาตแจ้งเตือน — เปิดได้ที่ตั้งค่าเครื่อง',
        };
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
        return { ok: false, status: 'error', message: 'สมัครแจ้งเตือนไม่สำเร็จ' };
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
      return {
        ok: true,
        status: 'ready',
        message: 'เปิดแจ้งเตือนเครื่องแล้ว — จะดังแม้ปิดแอปไว้',
      };
    } catch (error) {
      console.warn('[web-push] ensureSubscribed failed', error);
      return {
        ok: false,
        status: 'error',
        message: 'เปิดแจ้งเตือนเครื่องไม่สำเร็จ ลองใหม่อีกครั้ง',
      };
    }
  }
}
