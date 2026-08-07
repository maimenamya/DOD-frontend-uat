import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { ApiConfig } from '../core/api-config';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replaceAll('-', '+').replaceAll('_', '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.codePointAt(i) ?? 0;
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

function isAndroidDevice(): boolean {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
}

/** Line / Facebook / Instagram in-app browsers — no reliable Web Push. */
function isRestrictedInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return (
    /\bFBAN\b|\bFBAV\b|\bFB_IAB\b/i.test(ua) ||
    /\bInstagram\b/i.test(ua) ||
    /\bLine\//i.test(ua)
  );
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

function androidDeniedMessage(): string {
  return (
    'เครื่อง/Chrome ปิดการแจ้งเตือนไว้ — ตั้งค่า → แอป → Chrome → การแจ้งเตือน → อนุญาต ' +
    'แล้วที่ไซต์นี้: เมนู Chrome (⋮) → ข้อมูลเว็บไซต์ → การแจ้งเตือน → อนุญาต แล้วกดปุ่มอีกครั้ง'
  );
}

function restrictedBrowserMessage(): string {
  return (
    'เปิดจากแอปแชท (เช่น Line) ใช้แจ้งเตือนเครื่องไม่ได้ — เปิดใน Chrome แล้วเข้าจากไอคอนหน้าจอหลัก'
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
   * Pass `requestPermission: true` only from a user tap (required on iPhone / many Android).
   */
  ensureSubscribed(options?: { requestPermission?: boolean }): Promise<WebPushEnsureResult> {
    if (this.ensureInFlight) return this.ensureInFlight;
    this.ensureInFlight = this.runEnsure(Boolean(options?.requestPermission)).finally(() => {
      this.ensureInFlight = null;
    });
    return this.ensureInFlight;
  }

  /**
   * Drop OS push for this browser (endpoint).
   * Used when OWNER/MANAGER logs in after a prior SERVICE subscription on the same device.
   */
  async clearSubscription(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    try {
      const registration =
        (await navigator.serviceWorker.getRegistration('/')) ??
        (await navigator.serviceWorker.getRegistration());
      if (!registration) return;

      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) return;

      const endpoint = subscription.endpoint;
      try {
        await firstValueFrom(
          this.http.post(this.api.resource('notifications/push/unsubscribe'), { endpoint }),
        );
      } catch {
        // Still unsubscribe locally even if API fails (offline / 401).
      }
      await subscription.unsubscribe();
    } catch (error) {
      console.warn('[web-push] clearSubscription failed', error);
    }
  }

  async getStatusHint(): Promise<WebPushEnsureResult> {
    if (typeof window === 'undefined') {
      return { ok: false, status: 'unsupported', message: 'ไม่รองรับบนอุปกรณ์นี้' };
    }
    if (!window.isSecureContext) {
      return { ok: false, status: 'insecure', message: 'ต้องเปิดผ่าน HTTPS' };
    }
    if (isRestrictedInAppBrowser()) {
      return { ok: false, status: 'unsupported', message: restrictedBrowserMessage() };
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
          : isAndroidDevice()
            ? 'เบราว์เซอร์นี้ไม่รองรับแจ้งเตือนเครื่อง — เปิดด้วย Chrome แล้วลองใหม่'
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
        message: isAndroidDevice()
          ? androidDeniedMessage()
          : isIosDevice()
            ? 'เครื่องปิดการแจ้งเตือนไว้ — เปิดได้ที่ตั้งค่า iPhone → การแจ้งเตือน'
            : 'เบราว์เซอร์ปิดการแจ้งเตือนไว้ — เปิดสิทธิ์ที่การตั้งค่าไซต์แล้วลองใหม่',
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
    if (isRestrictedInAppBrowser()) {
      return { ok: false, status: 'unsupported', message: restrictedBrowserMessage() };
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
          : isAndroidDevice()
            ? 'เบราว์เซอร์นี้ไม่รองรับแจ้งเตือนเครื่อง — เปิดด้วย Chrome แล้วลองใหม่'
            : 'เบราว์เซอร์นี้ไม่รองรับแจ้งเตือนเครื่อง',
      };
    }

    try {
      // Ask permission BEFORE any network/SW await — many Android Chrome builds
      // drop the user-gesture if we fetch VAPID first, so the prompt never appears.
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
          message: isAndroidDevice()
            ? androidDeniedMessage()
            : 'ยังไม่อนุญาตแจ้งเตือน — เปิดได้ที่ตั้งค่าเครื่อง',
        };
      }

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

      const registration = await navigator.serviceWorker.register('/push-sw.js?v=20260726', {
        scope: '/',
      });
      await navigator.serviceWorker.ready;

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
      const name =
        error && typeof error === 'object' && 'name' in error
          ? String((error as { name?: string }).name)
          : '';
      if (name === 'AbortError' || name === 'NotAllowedError') {
        return {
          ok: false,
          status: 'denied',
          message: isAndroidDevice()
            ? androidDeniedMessage()
            : 'ยังไม่อนุญาตแจ้งเตือน — เปิดได้ที่ตั้งค่าเครื่อง',
        };
      }
      return {
        ok: false,
        status: 'error',
        message: isAndroidDevice()
          ? 'เปิดแจ้งเตือนไม่สำเร็จ — ใช้ Chrome, อนุญาตการแจ้งเตือนในตั้งค่าแอป แล้วกดปุ่มอีกครั้ง'
          : 'เปิดแจ้งเตือนเครื่องไม่สำเร็จ ลองใหม่อีกครั้ง',
      };
    }
  }
}
