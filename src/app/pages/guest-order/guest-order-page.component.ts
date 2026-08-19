import { DecimalPipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest, distinctUntilChanged, map } from 'rxjs';

import { writeStoredShopPublicId } from '../../core/shop-public-id.storage';
import type {
  GuestMenuItem,
  GuestOrderCartLine,
  GuestOrderItemType,
  GuestOrderMenuPayload,
} from '../../models/guest-order';
import { GuestOrderService } from '../../services/guest-order.service';

type MenuTab = 'FOOD' | 'DRINK' | 'FREE_MIXER' | 'PROMOTION' | 'MEMBERSHIP';

@Component({
  selector: 'app-guest-order-page',
  imports: [DecimalPipe],
  templateUrl: './guest-order-page.component.html',
  styleUrl: './guest-order-page.component.css',
})
export class GuestOrderPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly guestOrder = inject(GuestOrderService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly shopPublicId = toSignal(
    combineLatest([this.route.paramMap, this.route.queryParamMap]).pipe(
      map(
        ([params, query]) =>
          (query.get('shop') ?? params.get('shopPublicId') ?? '').trim(),
      ),
    ),
    { initialValue: '' },
  );

  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly menu = signal<GuestOrderMenuPayload | null>(null);
  readonly activeTab = signal<MenuTab>('FOOD');
  readonly cartOpen = signal(false);
  readonly cart = signal<GuestOrderCartLine[]>([]);
  readonly search = signal('');

  private token = '';

  readonly cartCount = computed(() =>
    this.cart().reduce((sum, row) => sum + row.quantity, 0),
  );
  readonly cartTotal = computed(() =>
    this.cart().reduce((sum, row) => sum + row.unitPrice * row.quantity, 0),
  );

  readonly hasFreeMixerEntitlement = computed(() => {
    const payload = this.menu();
    if (!payload) return false;
    if (payload.session.hasFreeMixerPackage) return true;
    return this.cart().some((row) => this.cartLineGrantsFreeMixer(payload, row));
  });

  readonly mixerItems = computed(() => {
    const payload = this.menu();
    if (!payload) return [] as GuestMenuItem[];
    return payload.beverages.filter((row) => row.isMixer === true);
  });

  readonly showFreeMixerTab = computed(
    () => this.hasFreeMixerEntitlement() && this.mixerItems().length > 0,
  );

  readonly showPaidDrinkTab = computed(() => {
    const payload = this.menu();
    if (!payload) return false;
    if (this.hasFreeMixerEntitlement()) {
      return payload.beverages.some((row) => row.isMixer !== true);
    }
    return payload.beverages.length > 0;
  });

  readonly visibleItems = computed(() => {
    const payload = this.menu();
    if (!payload) return [] as GuestMenuItem[];
    const tab = this.activeTab();
    const q = this.search().trim().toLowerCase();
    const source =
      tab === 'FOOD'
        ? payload.foods
        : tab === 'DRINK'
          ? this.hasFreeMixerEntitlement()
            ? payload.beverages.filter((row) => row.isMixer !== true)
            : payload.beverages
          : tab === 'FREE_MIXER'
            ? this.mixerItems()
            : tab === 'PROMOTION'
              ? payload.promotions
              : payload.memberships;
    if (!q) return source;
    return source.filter((row) => row.name.toLowerCase().includes(q));
  });

  constructor() {
    effect(() => {
      if (this.activeTab() === 'FREE_MIXER' && !this.showFreeMixerTab()) {
        this.activeTab.set(this.showPaidDrinkTab() ? 'DRINK' : 'FOOD');
      }
    });
  }

  ngOnInit(): void {
    const legacyShop = this.route.snapshot.paramMap.get('shopPublicId')?.trim() ?? '';
    if (legacyShop) {
      const token =
        this.route.snapshot.queryParamMap.get('t')?.trim() ??
        this.route.snapshot.queryParamMap.get('token')?.trim() ??
        '';
      void this.router.navigate(['/order'], {
        queryParams: { shop: legacyShop, ...(token ? { t: token } : {}) },
        replaceUrl: true,
      });
      return;
    }

    this.route.queryParamMap
      .pipe(
        map((params) => ({
          token: params.get('t')?.trim() ?? params.get('token')?.trim() ?? '',
          shop: params.get('shop')?.trim() ?? '',
        })),
        distinctUntilChanged(
          (a, b) => a.token === b.token && a.shop === b.shop,
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ token, shop }) => {
        this.token = token;
        if (shop) writeStoredShopPublicId(shop);
        this.loadMenu();
      });
  }

  setTab(tab: MenuTab, event?: Event): void {
    this.activeTab.set(tab);
    const btn = event?.currentTarget;
    if (btn instanceof HTMLElement) {
      btn.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.search.set(value);
  }

  addToCart(item: GuestMenuItem, type: GuestOrderItemType): void {
    this.successMessage.set(null);
    const key = `${type}:${item.id}`;
    const existing = this.cart().find((row) => row.key === key);
    if (existing) {
      this.cart.update((rows) =>
        rows.map((row) =>
          row.key === key ? { ...row, quantity: Math.min(99, row.quantity + 1) } : row,
        ),
      );
      this.syncMixerCartPrices();
      return;
    }
    const isMixer = type === 'DRINK' && item.isMixer === true;
    const isFreeMixer = isMixer && this.hasFreeMixerEntitlement();
    this.cart.update((rows) => [
      ...rows,
      {
        key,
        itemId: item.id,
        type,
        name: item.name,
        catalogPrice: item.price,
        unitPrice: isFreeMixer ? 0 : item.price,
        unitLabelTh: item.unitLabelTh,
        quantity: 1,
        isMixer,
        isFreeMixer,
      },
    ]);
    this.syncMixerCartPrices();
  }

  changeQty(key: string, delta: number): void {
    this.cart.update((rows) =>
      rows
        .map((row) =>
          row.key === key
            ? { ...row, quantity: Math.max(0, Math.min(99, row.quantity + delta)) }
            : row,
        )
        .filter((row) => row.quantity > 0),
    );
    this.syncMixerCartPrices();
  }

  openCart(): void {
    this.cartOpen.set(true);
  }

  closeCart(): void {
    this.cartOpen.set(false);
  }

  clearCart(): void {
    this.cart.set([]);
  }

  confirmOrder(): void {
    if (this.submitting() || !this.token) return;
    const lines = this.cart();
    if (lines.length === 0) {
      this.error.set('กรุณาเลือกรายการอย่างน้อย 1 รายการ');
      return;
    }

    this.submitting.set(true);
    this.error.set(null);
    this.successMessage.set(null);

    this.guestOrder
      .submitOrder(
        this.token,
        lines.map((row) => ({
          itemId: row.itemId,
          quantity: row.quantity,
          type: row.type,
        })),
        this.shopPublicId() || undefined,
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.submitting.set(false);
          this.cart.set([]);
          this.cartOpen.set(false);
          this.successMessage.set(`ส่งออเดอร์แล้ว · ${result.tableLabel}`);
          this.refreshMenuAfterOrder();
        },
        error: (err: { error?: { error?: string } }) => {
          this.submitting.set(false);
          this.error.set(err.error?.error ?? 'ส่งออเดอร์ไม่สำเร็จ');
        },
      });
  }

  itemTypeForTab(): GuestOrderItemType {
    return this.activeTab() === 'FREE_MIXER' ? 'DRINK' : this.activeTab();
  }

  displayPrice(item: GuestMenuItem): number {
    return this.isDisplayedFreeMixer(item) ? 0 : item.price;
  }

  isDisplayedFreeMixer(item: GuestMenuItem): boolean {
    return this.activeTab() === 'FREE_MIXER' && item.isMixer === true;
  }

  private cartLineGrantsFreeMixer(
    payload: GuestOrderMenuPayload,
    row: GuestOrderCartLine,
  ): boolean {
    if (row.type === 'PROMOTION') {
      return payload.promotions.some((item) => item.id === row.itemId && item.isFreeMixer === true);
    }
    if (row.type === 'MEMBERSHIP') {
      return payload.memberships.some((item) => item.id === row.itemId && item.isFreeMixer === true);
    }
    return false;
  }

  private syncMixerCartPrices(): void {
    const payload = this.menu();
    if (!payload) return;
    const entitled =
      payload.session.hasFreeMixerPackage ||
      this.cart().some((row) => this.cartLineGrantsFreeMixer(payload, row));
    this.cart.update((rows) =>
      rows.map((row) => {
        if (row.type !== 'DRINK' || !row.isMixer) return row;
        const unitPrice = entitled ? 0 : row.catalogPrice;
        const isFreeMixer = entitled;
        if (row.unitPrice === unitPrice && row.isFreeMixer === isFreeMixer) return row;
        return { ...row, unitPrice, isFreeMixer };
      }),
    );
  }

  private refreshMenuAfterOrder(): void {
    if (!this.token) return;
    this.guestOrder
      .getMenu(this.token, this.shopPublicId() || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (payload) => {
          const urlPublicId = this.shopPublicId();
          if (urlPublicId && payload.shop.publicId !== urlPublicId) return;
          this.menu.set(payload);
        },
      });
  }

  private loadMenu(): void {
    if (!this.token) {
      this.loading.set(false);
      this.error.set('ลิงก์ไม่ถูกต้อง — กรุณาสแกน QR จากโต๊ะอีกครั้ง');
      this.menu.set(null);
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.guestOrder
      .getMenu(this.token, this.shopPublicId() || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (payload) => {
          const urlPublicId = this.shopPublicId();
          if (urlPublicId && payload.shop.publicId !== urlPublicId) {
            this.error.set('ลิงก์ไม่ตรงกับร้านนี้');
            this.loading.set(false);
            this.menu.set(null);
            return;
          }
          this.menu.set(payload);
          if (payload.foods.length > 0) this.activeTab.set('FOOD');
          else if (payload.beverages.length > 0) this.activeTab.set('DRINK');
          else if (payload.promotions.length > 0) this.activeTab.set('PROMOTION');
          else if (payload.memberships.length > 0) this.activeTab.set('MEMBERSHIP');
          this.loading.set(false);
        },
        error: (err: { error?: { error?: string } }) => {
          this.loading.set(false);
          this.menu.set(null);
          this.error.set(err.error?.error ?? 'โหลดเมนูไม่สำเร็จ');
        },
      });
  }
}
