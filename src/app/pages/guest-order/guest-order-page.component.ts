import { DecimalPipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
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

type MenuTab = 'FOOD' | 'DRINK' | 'PROMOTION' | 'MEMBERSHIP';

@Component({
  selector: 'app-guest-order-page',
  imports: [DecimalPipe, FormsModule],
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

  readonly visibleItems = computed(() => {
    const payload = this.menu();
    if (!payload) return [] as GuestMenuItem[];
    const tab = this.activeTab();
    const q = this.search().trim().toLowerCase();
    const source =
      tab === 'FOOD'
        ? payload.foods
        : tab === 'DRINK'
          ? payload.beverages
          : tab === 'PROMOTION'
            ? payload.promotions
            : payload.memberships;
    if (!q) return source;
    return source.filter((row) => row.name.toLowerCase().includes(q));
  });

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

  setTab(tab: MenuTab): void {
    this.activeTab.set(tab);
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
      return;
    }
    this.cart.update((rows) => [
      ...rows,
      {
        key,
        itemId: item.id,
        type,
        name: item.name,
        unitPrice: item.price,
        unitLabelTh: item.unitLabelTh,
        quantity: 1,
      },
    ]);
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
        },
        error: (err: { error?: { error?: string } }) => {
          this.submitting.set(false);
          this.error.set(err.error?.error ?? 'ส่งออเดอร์ไม่สำเร็จ');
        },
      });
  }

  itemTypeForTab(): GuestOrderItemType {
    return this.activeTab();
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
