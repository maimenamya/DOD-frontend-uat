import {
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';

import { receivesShopNotifications } from '../../models/work-duty';
import type { ShopNotificationItem } from '../../services/notification.service';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';

const POLL_ACTIVE_MS = 15_000;
const POLL_IDLE_MS = 30_000;
const UNCHANGED_POLLS_BEFORE_IDLE = 2;

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
    const user = this.auth.getUser();
    if (!user) return false;
    return receivesShopNotifications(user);
  });

  readonly menuOpen = signal(false);
  readonly items = signal<ShopNotificationItem[]>([]);
  readonly unreadCount = signal(0);
  readonly loading = signal(false);

  private unchangedPolls = 0;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSnapshot = '';

  ngOnInit(): void {
    if (!this.visible()) return;
    this.schedulePoll(0);
    this.bindVisibilityRefresh();
    this.destroyRef.onDestroy(() => this.clearPollTimer());
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.menuOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.app-notification-bell-root')) {
      this.menuOpen.set(false);
    }
  }

  toggleMenu(): void {
    const next = !this.menuOpen();
    this.menuOpen.set(next);
    if (next) {
      this.fetchNotifications();
    }
  }

  markAllRead(): void {
    if (this.unreadCount() === 0) return;
    this.notifications.markAllRead().subscribe({
      next: () => {
        this.items.update((rows) => rows.map((row) => ({ ...row, isRead: true })));
        this.unreadCount.set(0);
        this.unchangedPolls = 0;
      },
    });
  }

  openItem(item: ShopNotificationItem): void {
    this.menuOpen.set(false);
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
      void this.router.navigate(['/dashboard/kitchen-queue']);
      return;
    }
    if (type === 'DRINK_ORDER') {
      void this.router.navigate(['/dashboard/bar-queue']);
      return;
    }
    if (type === 'FOOD_READY' || type === 'DRINK_READY') {
      void this.router.navigate(['/dashboard/service-pickup']);
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

  private fetchNotifications(): void {
    if (!this.visible()) return;
    this.loading.set(true);
    this.notifications.list().subscribe({
      next: (result) => {
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
