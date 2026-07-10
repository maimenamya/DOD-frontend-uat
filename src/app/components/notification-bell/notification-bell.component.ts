import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';

import { receivesShopNotifications } from '../../models/work-duty';
import type { WorkDuty } from '../../models/work-duty';
import type { ShopNotificationItem } from '../../services/notification.service';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';

const POLL_ACTIVE_MS = 15_000;
const POLL_IDLE_MS = 30_000;
const UNCHANGED_POLLS_BEFORE_IDLE = 2;
const MOBILE_MENU_MQL = '(max-width: 999px)';

@Component({
  selector: 'app-notification-bell',
  templateUrl: './notification-bell.component.html',
})
export class NotificationBellComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly visible = computed(() => {
    const user = this.auth.session()?.user;
    if (!user) return false;
    return receivesShopNotifications(user);
  });

  readonly menuOpen = signal(false);
  readonly items = signal<ShopNotificationItem[]>([]);
  readonly unreadCount = signal(0);
  readonly loading = signal(false);

  private readonly bellRoot = viewChild<ElementRef<HTMLElement>>('bellRoot');
  private readonly backdropRef = viewChild<ElementRef<HTMLButtonElement>>('backdrop');
  private readonly menuRef = viewChild<ElementRef<HTMLElement>>('menu');

  private unchangedPolls = 0;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSnapshot = '';
  private pollStarted = false;

  constructor() {
    effect(() => {
      const show = this.visible();
      if (show && !this.pollStarted) {
        this.pollStarted = true;
        this.schedulePoll(0);
      }
      if (!show) {
        this.pollStarted = false;
        this.clearPollTimer();
        this.closeMenu();
      }
    });

    effect(() => {
      if (this.menuOpen()) {
        queueMicrotask(() => this.syncMenuPortal());
      } else {
        this.restoreMenuPortal();
      }
    });

    this.destroyRef.onDestroy(() => {
      this.clearPollTimer();
      this.restoreMenuPortal();
      document.body.classList.remove('app-notification-sheet-open');
    });
  }

  ngOnInit(): void {
    this.bindVisibilityRefresh();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeMenu();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (
      target?.closest('.app-notification-bell-root') ||
      target?.closest('.app-notification-menu') ||
      target?.closest('.app-notification-backdrop')
    ) {
      return;
    }
    this.closeMenu();
  }

  toggleMenu(): void {
    const next = !this.menuOpen();
    this.menuOpen.set(next);
    if (next) {
      this.fetchNotifications();
    }
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  openItem(item: ShopNotificationItem): void {
    this.closeMenu();
    if (!item.isRead) {
      this.notifications.markRead(item.id).subscribe({
        next: () => {
          this.items.update((rows) =>
            rows.map((row) => (row.id === item.id ? { ...row, isRead: true } : row)),
          );
          this.unreadCount.update((count) => Math.max(0, count - 1));
          this.unchangedPolls = 0;
        },
      });
    }

    const sessionId = item.payload['sessionId'];
    const type = item.type;

    if (type === 'FOOD_ORDER') {
      void this.router.navigate(['/dashboard/station-work', 'food']);
      return;
    }
    if (type === 'DRINK_ORDER') {
      void this.router.navigate(['/dashboard/station-work', 'drink']);
      return;
    }
    if (type === 'FOOD_READY' || type === 'DRINK_READY') {
      void this.router.navigate(['/dashboard/station-work', 'pickup']);
      return;
    }

    const queryParams =
      typeof sessionId === 'number' && Number.isFinite(sessionId)
        ? { sessionId: String(sessionId) }
        : typeof sessionId === 'string' && sessionId.trim() !== ''
          ? { sessionId: sessionId.trim() }
          : {};

    void this.router.navigate(['/dashboard/open-table'], { queryParams });
  }

  private bindVisibilityRefresh(): void {
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible' && this.visible()) {
        this.unchangedPolls = 0;
        this.fetchNotifications();
      } else {
        this.clearPollTimer();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    this.destroyRef.onDestroy(() =>
      document.removeEventListener('visibilitychange', onVisibility),
    );
  }

  private schedulePoll(delayMs: number): void {
    this.clearPollTimer();
    this.pollTimer = setTimeout(() => {
      if (document.visibilityState !== 'visible' || !this.visible()) {
        return;
      }
      this.fetchNotifications();
    }, delayMs);
  }

  private clearPollTimer(): void {
    if (this.pollTimer != null) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private pollIntervalMs(): number {
    return this.unchangedPolls >= UNCHANGED_POLLS_BEFORE_IDLE ? POLL_IDLE_MS : POLL_ACTIVE_MS;
  }

  private isMobileViewport(): boolean {
    return window.matchMedia(MOBILE_MENU_MQL).matches;
  }

  private syncMenuPortal(): void {
    if (!this.isMobileViewport()) return;

    const root = this.bellRoot()?.nativeElement;
    const backdrop = this.backdropRef()?.nativeElement;
    const menu = this.menuRef()?.nativeElement;
    if (!root || !backdrop || !menu) return;

    if (backdrop.parentElement !== document.body) {
      document.body.appendChild(backdrop);
    }
    if (menu.parentElement !== document.body) {
      document.body.appendChild(menu);
    }
    document.body.classList.add('app-notification-sheet-open');
  }

  private restoreMenuPortal(): void {
    document.body.classList.remove('app-notification-sheet-open');

    const root = this.bellRoot()?.nativeElement;
    const backdrop = this.backdropRef()?.nativeElement;
    const menu = this.menuRef()?.nativeElement;
    if (!root) return;

    if (backdrop && backdrop.parentElement !== root) {
      root.appendChild(backdrop);
    }
    if (menu && menu.parentElement !== root) {
      root.appendChild(menu);
    }
  }

  private syncRecipientDuties(duties: WorkDuty[]): void {
    const user = this.auth.getUser();
    if (!user || duties.length === 0) return;
    const current = user.workDuties ?? [];
    if (
      current.length === duties.length &&
      current.every((duty, index) => duty === duties[index])
    ) {
      return;
    }
    this.auth.updateSessionUser({ ...user, workDuties: duties });
  }

  private fetchNotifications(): void {
    if (!this.visible()) return;
    this.loading.set(true);
    this.notifications.list().subscribe({
      next: (result) => {
        this.syncRecipientDuties(result.recipientDuties ?? []);
        const snapshot = `${result.unreadCount}:${result.items[0]?.id ?? 'none'}`;
        if (snapshot === this.lastSnapshot) {
          this.unchangedPolls += 1;
        } else {
          this.unchangedPolls = 0;
        }
        this.lastSnapshot = snapshot;
        this.items.set(result.items);
        this.unreadCount.set(result.unreadCount);
        this.loading.set(false);
        this.schedulePoll(this.pollIntervalMs());
      },
      error: () => {
        this.loading.set(false);
        this.schedulePoll(POLL_IDLE_MS);
      },
    });
  }
}
