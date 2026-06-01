import { CommonModule, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, finalize, forkJoin, of } from 'rxjs';

import { AppModalComponent } from '../../components/app-modal/app-modal.component';
import { ShopDatetimeInputComponent } from '../../components/shop-datetime-input/shop-datetime-input.component';
import {
  CustomDropdownComponent,
  type DropdownOption,
} from '../../components/custom-dropdown/custom-dropdown.component';
import type { MstEmployee } from '../../models/employee';
import type { MstFood, MstFoodCategory, MstMembership, MstPromotion } from '../../models/master-data';
import type { MstRole } from '../../models/role';
import type {
  AddItemsPayload,
  CheckoutPreview,
  OpenTableSessionDetail,
  SeatStatus,
  SessionOrderItem,
  SessionRoomCharge,
  SessionStaffDrink,
} from '../../models/open-table';
import type { SeatingRateType } from '../../models/seating';
import type { MstBeverage } from '../../models/beverage';
import type { MstOtherCharge } from '../../models/other-charge';
import { OtherChargeService } from '../../services/other-charge.service';
import {
  ORDER_LEDGER_CATEGORY_LABELS,
  ORDER_LEDGER_CATEGORY_VALUES,
  currentDatetimeLocalValue,
  isEntertainmentStaffRole,
  isValidShopDatetimeLocal,
  isFixedDrinkStaffRole,
  type OrderLedgerCategory,
} from './open-table-ledger.util';
import { AuthService } from '../../services/auth.service';
import { BeverageService } from '../../services/beverage.service';
import { EmployeeService } from '../../services/employee.service';
import { OpenTableService } from '../../services/open-table.service';
import { RoleService } from '../../services/role.service';
import { ShopMasterService } from '../../services/shop-master.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';
import { closeOpenShopFlatpickrCalendars } from '../../utils/flatpickr-shop.util';
import { compareRolesByThaiLabel, roleOptionLabel } from '../../utils/role-display.util';
import {
  blockNonNumericInputKey,
  parsePositiveIntFromText,
  sanitizeDigitsOnly,
} from '../../utils/numeric-input.util';

type SeatTypeFilter = number | 'ALL';
type SeatStatusFilter = 'ALL' | 'AVAILABLE' | 'OCCUPIED' | 'AWAITING_CLEAR';
type AddModalMode = 'ORDER_LEDGER' | 'STAFF_LEDGER';

const OWNER_ROLE = 'OWNER';

type SeatingTypeZone = { id: number; name: string; rateType: SeatingRateType };

type SeatTile = {
  key: string;
  seatId: number;
  code: string;
  seatingTypeId: number;
  zoneLabel: string;
  status: SeatStatus;
  sessionId: number | null;
  sessionRevision: number | null;
  saleName?: string;
};

@Component({
  selector: 'app-open-table-page',
  imports: [
    CommonModule,
    DecimalPipe,
    FormsModule,
    AppModalComponent,
    CustomDropdownComponent,
    ShopDatetimeInputComponent,
  ],
  templateUrl: './open-table-page.component.html',
  styleUrl: './open-table-page.component.css',
})
export class OpenTablePageComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly openTableService = inject(OpenTableService);
  private readonly shopMaster = inject(ShopMasterService);
  private readonly otherChargeService = inject(OtherChargeService);
  private readonly beverageService = inject(BeverageService);
  private readonly employeeService = inject(EmployeeService);
  private readonly roleService = inject(RoleService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly loading = signal(true);
  readonly actionBusy = signal(false);
  readonly search = signal('');
  readonly typeFilter = signal<SeatTypeFilter>('ALL');
  readonly seatingTypeZones = signal<SeatingTypeZone[]>([]);
  readonly statusFilter = signal<SeatStatusFilter>('ALL');
  readonly selectedSeatKey = signal<string | null>(null);
  readonly showMobileSheet = signal(false);
  readonly sessionDetail = signal<OpenTableSessionDetail | null>(null);
  readonly sessionDetailLoading = signal(false);
  private sessionDetailRequestSeq = 0;

  readonly showAddModal = signal(false);
  readonly showTransferModal = signal(false);
  readonly showStopDrinkModal = signal(false);
  readonly showStopRoomModal = signal(false);
  readonly showReturnBeverageModal = signal(false);
  readonly showCheckoutModal = signal(false);
  readonly checkoutAt = signal(currentDatetimeLocalValue());
  readonly checkoutPreview = signal<CheckoutPreview | null>(null);
  readonly checkoutPreviewLoading = signal(false);
  private checkoutPreviewTimer: ReturnType<typeof setTimeout> | null = null;
  readonly stopDrinkTarget = signal<SessionStaffDrink | null>(null);
  readonly stopRoomTarget = signal<SessionRoomCharge | null>(null);
  readonly returnBeverageTarget = signal<SessionOrderItem | null>(null);
  readonly returnBeverageQtyText = signal('1');
  readonly stopSeatTime = signal(currentDatetimeLocalValue());
  readonly addModalMode = signal<AddModalMode>('ORDER_LEDGER');

  readonly seats = signal<SeatTile[]>([]);
  readonly saleEmployees = signal<MstEmployee[]>([]);
  readonly checkInSalesId = signal<number | null>(null);
  private readonly openTableOtherChargesRaw = signal<MstOtherCharge[]>([]);
  /** Standalone toggles + one id per choice group. */
  private readonly foodCategoriesRaw = signal<MstFoodCategory[]>([]);
  private readonly foodsRaw = signal<MstFood[]>([]);
  private readonly beveragesRaw = signal<MstBeverage[]>([]);
  private readonly cocktailsRaw = signal<{ id: number; name: string; drinkValue: number }[]>([]);
  private readonly promotionsRaw = signal<MstPromotion[]>([]);
  private readonly membershipsRaw = signal<MstMembership[]>([]);
  readonly staffEmployees = signal<MstEmployee[]>([]);
  /** All positions from master MstRole table (excludes OWNER in dropdowns). */
  private readonly masterRolesFromApi = signal<MstRole[]>([]);
  readonly staffLedgerRoles = signal<MstRole[]>([]);

  readonly orderLedgerCategory = signal<OrderLedgerCategory>('FOOD');
  readonly selectedFoodCategoryId = signal<number | null>(null);
  readonly selectedFoodId = signal<number | null>(null);
  readonly selectedBeverageId = signal<number | null>(null);
  readonly selectedCocktailId = signal<number | null>(null);
  readonly selectedPromotionId = signal<number | null>(null);
  readonly selectedMembershipId = signal<number | null>(null);
  readonly selectedOtherChargeId = signal<number | null>(null);
  readonly orderCocktailStaffRoleId = signal<number | null>(null);
  readonly orderCocktailStaffEmployeeId = signal<number | null>(null);
  readonly orderQtyText = signal('1');

  readonly staffLedgerRoleId = signal<number | null>(null);
  readonly staffLedgerEmployeeId = signal<number | null>(null);
  readonly staffLedgerQtyText = signal('1');
  readonly staffSeatStartedAt = signal(currentDatetimeLocalValue());

  /** Destination seat key: `seating-12`. */
  transferDestinationKey = signal<string | null>(null);
  transferSeatingTypeId = signal<number | null>(null);

  readonly blockNonNumericKey = blockNonNumericInputKey;

  constructor() {
    effect((onCleanup) => {
      const sessionId = this.selectedSeat()?.sessionId;
      if (sessionId == null || !this.drawerOpen() || this.anyModalOpen()) {
        return;
      }
      const timer = setInterval(
        () => this.loadSessionDetail(sessionId, { showLoading: false }),
        60_000,
      );
      onCleanup(() => clearInterval(timer));
    });
  }

  readonly filteredSeats = computed(() => {
    const keyword = this.search().trim().toLowerCase();
    return this.seats().filter((seat) => {
      const typeFilter = this.typeFilter();
      if (typeFilter !== 'ALL' && seat.seatingTypeId !== typeFilter) return false;
      if (this.statusFilter() === 'AVAILABLE' && seat.status !== 'AVAILABLE') return false;
      if (this.statusFilter() === 'OCCUPIED' && seat.status !== 'OCCUPIED') return false;
      if (this.statusFilter() === 'AWAITING_CLEAR' && seat.status !== 'AWAITING_CLEAR') {
        return false;
      }
      if (!keyword) return true;
      return [seat.code, seat.saleName ?? '', seat.zoneLabel].join(' ').toLowerCase().includes(keyword);
    });
  });

  readonly seatZones = computed(() => {
    const typeFilter = this.typeFilter();
    const seats = this.filteredSeats();
    return this.seatingTypeZones()
      .filter((z) => typeFilter === 'ALL' || z.id === typeFilter)
      .map((zone) => ({
        typeId: zone.id,
        label: zone.name,
        seats: seats.filter((s) => s.seatingTypeId === zone.id),
      }))
      .filter((z) => z.seats.length > 0);
  });
  readonly selectedSeat = computed(() =>
    this.selectedSeatKey()
      ? (this.seats().find((s) => s.key === this.selectedSeatKey()) ?? null)
      : null,
  );
  readonly availableTransferTargets = computed(() =>
    this.seats().filter((s) => s.status === 'AVAILABLE' && s.key !== this.selectedSeatKey()),
  );
  readonly totalDrinks = computed(() => this.sessionDetail()?.totalDrinks ?? 0);
  readonly totalAmount = computed(() => this.sessionDetail()?.totalAmount ?? 0);

  itemLineTotal(item: { quantity: number; unitPrice: number }): number {
    return item.quantity * item.unitPrice;
  }
  readonly drawerOpen = computed(() => this.selectedSeatKey() != null);
  readonly anyModalOpen = computed(
    () =>
      this.showAddModal() ||
      this.showTransferModal() ||
      this.showStopDrinkModal() ||
      this.showStopRoomModal() ||
      this.showCheckoutModal(),
  );

  /** มีลูกค้า = ยังเปิดบิลอยู่ (ไม่อิง API flag อย่างเดียว) */
  readonly seatLedgerOpen = computed(() => this.selectedSeat()?.status === 'OCCUPIED');

  readonly seatAwaitingClear = computed(
    () => this.selectedSeat()?.status === 'AWAITING_CLEAR',
  );

  /** ยังเพิ่มรายการ/ย้าย/เช็กบิลได้ — หลังเช็กบิลแล้วเป็น false */
  readonly ledgerCanMutate = computed(() => {
    if (!this.seatLedgerOpen()) return false;
    const detail = this.sessionDetail();
    if (detail?.canMutateLedger === false) return false;
    if (detail?.sessionStatus === 'BILLED') return false;
    return true;
  });

  readonly saleEmployeeOptions = computed<DropdownOption[]>(() =>
    this.saleEmployees().map((e) => ({ value: e.id, label: e.nickname })),
  );

  readonly orderMasterCategoryOptions = computed<DropdownOption[]>(() => {
    const options: DropdownOption[] = [];
    if (this.foodsRaw().length > 0) {
      options.push({ value: 'FOOD', label: ORDER_LEDGER_CATEGORY_LABELS.FOOD });
    }
    if (this.beveragesRaw().length > 0) {
      options.push({ value: 'BEVERAGE', label: ORDER_LEDGER_CATEGORY_LABELS.BEVERAGE });
    }
    if (this.cocktailsRaw().length > 0) {
      options.push({ value: 'COCKTAIL', label: ORDER_LEDGER_CATEGORY_LABELS.COCKTAIL });
    }
    if (this.promotionsRaw().length > 0) {
      options.push({ value: 'PROMOTION', label: ORDER_LEDGER_CATEGORY_LABELS.PROMOTION });
    }
    if (this.membershipsRaw().length > 0) {
      options.push({ value: 'MEMBER', label: ORDER_LEDGER_CATEGORY_LABELS.MEMBER });
    }
    if (this.activeOtherCharges().length > 0) {
      options.push({ value: 'OTHER', label: ORDER_LEDGER_CATEGORY_LABELS.OTHER });
    }
    return options;
  });

  readonly foodCategoryDropdownOptions = computed<DropdownOption[]>(() =>
    this.foodCategoriesRaw().map((c) => ({ value: c.id, label: c.name })),
  );

  readonly foodsInSelectedCategory = computed(() => {
    const categoryId = this.selectedFoodCategoryId();
    if (categoryId == null) return [];
    return this.foodsRaw().filter((f) => f.categoryId === categoryId);
  });

  readonly foodItemDropdownOptions = computed<DropdownOption[]>(() =>
    this.foodsInSelectedCategory().map((f) => ({
      value: f.id,
      label: f.name,
      hint: `${f.price} บาท`,
    })),
  );

  readonly beverageDropdownOptions = computed<DropdownOption[]>(() =>
    this.beveragesRaw().map((b) => ({
      value: b.id,
      label: b.name,
      hint: `${b.price} บาท`,
    })),
  );

  readonly cocktailDropdownOptions = computed<DropdownOption[]>(() =>
    this.cocktailsRaw().map((c) => ({
      value: c.id,
      label: c.name,
      hint: `${c.drinkValue} ดื่ม`,
    })),
  );

  readonly cocktailHostRoleOptions = computed<DropdownOption[]>(() =>
    this.masterRolesForDropdown().map((role) => ({
      value: role.id,
      label: roleOptionLabel(role),
    })),
  );

  readonly cocktailHostEmployeeOptions = computed<DropdownOption[]>(() => {
    const roleId = this.orderCocktailStaffRoleId();
    if (roleId == null) return [];
    return this.staffEmployees()
      .filter((e) => e.roleId === roleId)
      .map((e) => ({
        value: e.id,
        label: e.nickname,
        hint: e.employeeId,
      }));
  });

  readonly promotionDropdownOptions = computed<DropdownOption[]>(() =>
    this.promotionsRaw().map((p) => ({
      value: p.id,
      label: p.name,
      hint: `${p.packagePrice} บาท`,
    })),
  );

  readonly membershipDropdownOptions = computed<DropdownOption[]>(() =>
    this.membershipsRaw().map((m) => ({
      value: m.id,
      label: m.name,
      hint: `${m.packagePrice} บาท`,
    })),
  );

  readonly activeOtherCharges = computed(() =>
    this.openTableOtherChargesRaw().filter((c) => c.isActive),
  );

  readonly otherChargeDropdownOptions = computed<DropdownOption[]>(() =>
    this.activeOtherCharges().map((c) => ({
      value: c.id,
      label: c.name,
      hint: `${c.price} บาท/${c.unitLabelTh}`,
    })),
  );

  readonly staffLedgerRoleOptions = computed<DropdownOption[]>(() =>
    this.staffLedgerRoles().map((role) => ({
      value: role.id,
      label: roleOptionLabel(role),
    })),
  );

  readonly staffLedgerEmployees = computed(() => {
    const roleId = this.staffLedgerRoleId();
    if (roleId == null) return [];
    const role = this.staffLedgerRoles().find((r) => r.id === roleId);

    return this.staffEmployees().filter((e) => {
      if (e.roleId !== roleId) return false;
      // TODO(attendance): hide OFF_DUTY when shop has time-clock integration.
      if (role && isEntertainmentStaffRole(role)) {
        return e.tableSeatStatus !== 'ON_TABLE';
      }
      return true;
    });
  });

  readonly staffLedgerEmployeeOptions = computed<DropdownOption[]>(() =>
    this.staffLedgerEmployees().map((e) => ({
      value: e.id,
      label: e.nickname,
      hint: e.employeeId,
    })),
  );

  readonly selectedStaffLedgerRole = computed(() => {
    const roleId = this.staffLedgerRoleId();
    if (roleId == null) return null;
    return this.staffLedgerRoles().find((r) => r.id === roleId) ?? null;
  });

  readonly showStaffFixedDrinkQty = computed(() => {
    const role = this.selectedStaffLedgerRole();
    return role != null && isFixedDrinkStaffRole(role);
  });

  readonly showStaffSeatStartTime = computed(() => {
    const role = this.selectedStaffLedgerRole();
    return role != null && isEntertainmentStaffRole(role);
  });

  readonly transferTypesWithAvailability = computed(() => {
    const targets = this.availableTransferTargets();
    const typeIds = new Set(targets.map((t) => t.seatingTypeId));
    return this.seatingTypeZones().filter((z) => typeIds.has(z.id));
  });

  readonly transferSeatingTypeOptions = computed<DropdownOption[]>(() =>
    this.transferTypesWithAvailability().map((z) => ({ value: z.id, label: z.name })),
  );

  readonly transferDestinationOptions = computed<DropdownOption[]>(() => {
    const typeId = this.transferSeatingTypeId();
    if (typeId == null) return [];
    return this.availableTransferTargets()
      .filter((t) => t.seatingTypeId === typeId)
      .map((t) => ({ value: t.key, label: t.code }));
  });

  readonly selectedTransferSeatingType = computed(() =>
    this.seatingTypeZones().find((z) => z.id === this.transferSeatingTypeId()) ?? null,
  );

  readonly transferTimeChargeHint = computed(() => {
    const rateType = this.selectedTransferSeatingType()?.rateType;
    if (rateType === 'HOURLY' || rateType === 'FLAT_RATE') {
      return 'ย้ายเข้าประเภทนี้จะเริ่มคิดเวลาอัตโนมัติ · ย้ายออกจะหยุดเวลา';
    }
    if (rateType === 'NONE') {
      return 'ประเภทนี้ไม่คิดค่าเวลา';
    }
    return '';
  });

  setAddModalMode(mode: AddModalMode): void {
    this.addModalMode.set(mode);
    if (mode === 'STAFF_LEDGER') {
      this.stampStaffSeatStartTime();
    }
  }

  ngOnInit(): void {
    this.refreshFloorPlan();
    this.loadMasterData();
    this.startFloorPlanSync();
  }

  /** Keep floor tiles in sync when multiple staff use open-table (demo until Socket.io). */
  private startFloorPlanSync(): void {
    const intervalMs = 20_000;
    const timer = setInterval(() => {
      if (!this.anyModalOpen()) {
        this.refreshFloorPlan(this.selectedSeatKey(), { silent: true });
      }
    }, intervalMs);

    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') {
        this.refreshFloorPlan(this.selectedSeatKey(), { silent: true });
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    this.destroyRef.onDestroy(() => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    });
  }

  private get shopId(): number {
    return this.auth.session()?.user.shopId ?? 0;
  }

  private masterRolesForDropdown(): MstRole[] {
    const fromMaster = this.masterRolesFromApi()
      .filter((role) => role.name !== OWNER_ROLE)
      .sort(compareRolesByThaiLabel);
    if (fromMaster.length > 0) return fromMaster;
    return this.buildRolesFromEmployees(this.staffEmployees());
  }

  private syncStaffLedgerRoles(): void {
    const roles = this.masterRolesForDropdown();
    this.staffLedgerRoles.set(roles);
    if (
      this.staffLedgerRoleId() == null ||
      !roles.some((r) => r.id === this.staffLedgerRoleId())
    ) {
      this.staffLedgerRoleId.set(roles[0]?.id ?? null);
    }
    this.syncStaffLedgerEmployee();
  }

  private buildRolesFromEmployees(staff: MstEmployee[]): MstRole[] {
    const roles: MstRole[] = [];
    const seen = new Set<number>();
    for (const employee of staff) {
      const role = employee.role;
      if (!role || role.name === OWNER_ROLE || seen.has(role.id)) continue;
      seen.add(role.id);
      roles.push({
        id: role.id,
        name: role.name,
        category: role.category,
        startDrinks: role.startDrinks ?? 0,
        nextHourDrinks: role.nextHourDrinks ?? 0,
        defaultPricePerDrink: role.defaultPricePerDrink ?? 0,
      });
    }
    return roles.sort(compareRolesByThaiLabel);
  }

  /** อัปเดตโต๊ะทันทีหลังเปิดสำเร็จ — กัน UI ค้างแบบ "ว่าง" และกดเปิดซ้ำ */
  private applySeatCheckIn(
    seatKey: string,
    sessionId: number,
    saleName: string,
    sessionRevision: number,
  ): void {
    this.seats.update((tiles) =>
      tiles.map((s) =>
        s.key === seatKey
          ? { ...s, status: 'OCCUPIED', sessionId, sessionRevision, saleName }
          : s,
      ),
    );
    this.sessionDetail.set(null);
    this.loadSessionDetail(sessionId, { showLoading: true });
  }

  private applySeatAfterCheckout(seatKey: string, sessionId: number, checkedOutLabel?: string): void {
    this.seats.update((tiles) =>
      tiles.map((s) => (s.key === seatKey ? { ...s, status: 'AWAITING_CLEAR' } : s)),
    );
    this.closeAddModal();
    this.showAddModal.set(false);
    this.sessionDetail.set({
      sessionId,
      revision: this.sessionDetail()?.revision ?? this.selectedSeat()?.sessionRevision ?? 1,
      sessionStatus: 'BILLED',
      lastCheckedOutLabel: checkedOutLabel,
      canMutateLedger: false,
      canReleaseCustomer: true,
      seatKey,
      seatCode: this.selectedSeat()?.code ?? null,
      saleName: this.sessionDetail()?.saleName ?? this.selectedSeat()?.saleName ?? '—',
      items: [],
      staffDrinks: [],
      roomCharges: [],
      totalDrinks: 0,
      totalAmount: 0,
    });
    this.sessionDetailLoading.set(false);
  }

  private refreshFloorPlan(selectKey?: string | null, opts?: { silent?: boolean }): void {
    if (!opts?.silent) {
      this.loading.set(true);
    }
    this.openTableService
      .getFloorPlan()
      .pipe(
        catchError(() => {
          this.toast.showError('ไม่สามารถโหลดแผนผังโต๊ะได้');
          return of({ seatingTypes: [], seatings: [] });
        }),
        finalize(() => {
          if (!opts?.silent) {
            this.loading.set(false);
          }
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((plan) => {
        this.seatingTypeZones.set(
          plan.seatingTypes.map((t) => ({
            id: t.id,
            name: t.name,
            rateType: t.rateType,
          })),
        );
        const tiles: SeatTile[] = plan.seatingTypes.flatMap((type) =>
          type.seats.map((s) => ({
            key: `seating-${s.id}`,
            seatId: s.id,
            code: s.code,
            seatingTypeId: type.id,
            zoneLabel: type.name,
            status: s.status,
            sessionId: s.sessionId,
            sessionRevision: s.sessionRevision ?? null,
            saleName: s.saleName ?? undefined,
          })),
        );
        this.seats.set(tiles);
        const key = selectKey ?? this.selectedSeatKey();
        if (key) {
          const seat = tiles.find((s) => s.key === key);
          if (seat?.sessionId) {
            this.loadSessionDetail(seat.sessionId, { showLoading: false });
          } else {
            this.sessionDetail.set(null);
            this.sessionDetailLoading.set(false);
          }
        }
      });
  }

  private applyStaffEmployees(employees: MstEmployee[]): void {
    const active = employees.filter((e) => e.status === 'Active' && e.role?.name !== OWNER_ROLE);
    this.saleEmployees.set(active.filter((e) => e.role?.name === 'SALE'));
    this.staffEmployees.set(active);
    this.syncStaffLedgerRoles();
  }

  private reloadStaffEmployees(): void {
    const shopId = this.shopId;
    if (!shopId) return;
    this.employeeService
      .getEmployeesByShop(shopId)
      .pipe(catchError(() => of([] as MstEmployee[])), takeUntilDestroyed(this.destroyRef))
      .subscribe((employees) => this.applyStaffEmployees(employees));
  }

  private loadMasterData(): void {
    const shopId = this.shopId;
    if (!shopId) return;

    this.employeeService
      .getEmployeesByShop(shopId)
      .pipe(catchError(() => of([] as MstEmployee[])), takeUntilDestroyed(this.destroyRef))
      .subscribe((employees) => this.applyStaffEmployees(employees));

    this.roleService
      .getRoles()
      .pipe(catchError(() => of([] as MstRole[])), takeUntilDestroyed(this.destroyRef))
      .subscribe((roles) => {
        this.masterRolesFromApi.set(roles);
        this.syncStaffLedgerRoles();
      });

    forkJoin({
      categories: this.shopMaster.getFoodCategories().pipe(catchError(() => of([] as MstFoodCategory[]))),
      foods: this.shopMaster.getFoods().pipe(catchError(() => of([] as MstFood[]))),
      beverages: this.beverageService.getBeverages().pipe(catchError(() => of([] as MstBeverage[]))),
      cocktails: this.shopMaster.getCocktails().pipe(catchError(() => of([]))),
      promotions: this.shopMaster.getPromotions().pipe(catchError(() => of([] as MstPromotion[]))),
      memberships: this.shopMaster.getMemberships().pipe(catchError(() => of([] as MstMembership[]))),
      otherCharges: this.otherChargeService.getAll().pipe(catchError(() => of([] as MstOtherCharge[]))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ categories, foods, beverages, cocktails, promotions, memberships, otherCharges }) => {
        this.foodCategoriesRaw.set(categories);
        this.foodsRaw.set(foods);
        this.beveragesRaw.set(beverages);
        this.cocktailsRaw.set(
          cocktails.map((c) => ({ id: c.id, name: c.name, drinkValue: c.drinkValue })),
        );
        this.promotionsRaw.set(promotions);
        this.membershipsRaw.set(memberships);
        this.openTableOtherChargesRaw.set(otherCharges);
      });
  }

  private loadSessionDetail(
    sessionId: number,
    options: { showLoading?: boolean } = {},
  ): void {
    const showLoading = options.showLoading ?? false;
    const requestSeq = ++this.sessionDetailRequestSeq;

    if (showLoading) {
      this.sessionDetailLoading.set(true);
      this.sessionDetail.set(null);
    }

    this.openTableService
      .getSessionDetail(sessionId)
      .pipe(
        catchError(() => {
          this.toast.showError('ไม่สามารถโหลดรายละเอียดบิลได้');
          return of(null);
        }),
        finalize(() => {
          if (requestSeq === this.sessionDetailRequestSeq) {
            this.sessionDetailLoading.set(false);
          }
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((detail) => {
        if (requestSeq !== this.sessionDetailRequestSeq) return;
        if (this.selectedSeat()?.sessionId !== sessionId) return;
        this.sessionDetail.set(detail);
        if (detail) {
          this.syncSeatRevisionFromDetail(detail);
        }
      });
  }

  private expectedRevision(): number | null {
    const fromDetail = this.sessionDetail()?.revision;
    if (fromDetail != null && fromDetail >= 1) return fromDetail;
    const fromSeat = this.selectedSeat()?.sessionRevision;
    if (fromSeat != null && fromSeat >= 1) return fromSeat;
    return null;
  }

  private requireExpectedRevision(): number | null {
    const revision = this.expectedRevision();
    if (revision != null) return revision;
    this.toast.showError('กรุณารอโหลดบิลโต๊ะสักครู่ หรือรีเฟรชหน้า');
    const sessionId = this.selectedSeat()?.sessionId;
    if (sessionId != null) {
      this.loadSessionDetail(sessionId, { showLoading: false });
    }
    return null;
  }

  private syncSeatRevisionFromDetail(detail: OpenTableSessionDetail): void {
    const key = this.selectedSeatKey();
    if (!key) return;
    this.seats.update((tiles) =>
      tiles.map((s) => (s.key === key ? { ...s, sessionRevision: detail.revision } : s)),
    );
  }

  private onMutationConflict(): void {
    this.refreshFloorPlan(this.selectedSeatKey(), { silent: true });
  }

  private resetOrderLedgerForm(): void {
    const firstCategory =
      this.orderMasterCategoryOptions()[0]?.value ?? ORDER_LEDGER_CATEGORY_VALUES[0];
    this.orderLedgerCategory.set(firstCategory as OrderLedgerCategory);
    this.resetOrderLedgerCascade();
    this.orderQtyText.set('1');
  }

  private resetOrderLedgerCascade(): void {
    const category = this.orderLedgerCategory();
    this.selectedFoodCategoryId.set(null);
    this.selectedFoodId.set(null);
    this.selectedBeverageId.set(null);
    this.selectedCocktailId.set(null);
    this.selectedPromotionId.set(null);
    this.selectedMembershipId.set(null);
    this.selectedOtherChargeId.set(null);
    this.orderCocktailStaffRoleId.set(null);
    this.orderCocktailStaffEmployeeId.set(null);

    if (category === 'FOOD') {
      const firstCat = this.foodCategoriesRaw()[0];
      this.selectedFoodCategoryId.set(firstCat?.id ?? null);
      this.syncFoodItemSelection();
    } else if (category === 'BEVERAGE') {
      this.selectedBeverageId.set(this.beveragesRaw()[0]?.id ?? null);
    } else if (category === 'COCKTAIL') {
      this.selectedCocktailId.set(this.cocktailsRaw()[0]?.id ?? null);
      this.syncCocktailHostSelection();
    } else if (category === 'PROMOTION') {
      this.selectedPromotionId.set(this.promotionsRaw()[0]?.id ?? null);
    } else if (category === 'MEMBER') {
      this.selectedMembershipId.set(this.membershipsRaw()[0]?.id ?? null);
    } else if (category === 'OTHER') {
      this.selectedOtherChargeId.set(this.activeOtherCharges()[0]?.id ?? null);
    }
  }

  private syncFoodItemSelection(): void {
    const pool = this.foodsInSelectedCategory();
    const current = this.selectedFoodId();
    if (current != null && pool.some((f) => f.id === current)) return;
    this.selectedFoodId.set(pool[0]?.id ?? null);
  }

  private syncCocktailHostSelection(): void {
    const roles = this.masterRolesForDropdown();
    const roleId = this.orderCocktailStaffRoleId();
    if (roleId == null || !roles.some((r) => r.id === roleId)) {
      this.orderCocktailStaffRoleId.set(roles[0]?.id ?? null);
    }
    const pool = this.cocktailHostEmployeeOptions();
    const empId = this.orderCocktailStaffEmployeeId();
    if (empId == null || !pool.some((o) => o.value === empId)) {
      this.orderCocktailStaffEmployeeId.set(
        pool[0]?.value != null ? Number(pool[0].value) : null,
      );
    }
  }

  private resetStaffLedgerForm(): void {
    this.syncStaffLedgerRoles();
    this.staffLedgerQtyText.set('1');
    this.stampStaffSeatStartTime();
  }

  private stampStaffSeatStartTime(): void {
    this.staffSeatStartedAt.set(currentDatetimeLocalValue());
  }

  private syncStaffLedgerEmployee(): void {
    const pool = this.staffLedgerEmployees();
    const current = this.staffLedgerEmployeeId();
    if (current != null && pool.some((e) => e.id === current)) return;
    this.staffLedgerEmployeeId.set(pool[0]?.id ?? null);
  }

  onOrderLedgerCategoryChange(value: number | string | null): void {
    const category = String(value ?? '') as OrderLedgerCategory;
    if (!ORDER_LEDGER_CATEGORY_VALUES.includes(category)) return;
    this.orderLedgerCategory.set(category);
    this.resetOrderLedgerCascade();
  }

  onFoodCategoryChange(value: number | string | null): void {
    const id = value == null || value === '' ? null : Number(value);
    if (id == null || !Number.isFinite(id)) return;
    if (!this.foodCategoriesRaw().some((c) => c.id === id)) return;
    this.selectedFoodCategoryId.set(id);
    this.selectedFoodId.set(null);
    this.syncFoodItemSelection();
  }

  onFoodItemChange(value: number | string | null): void {
    const id = value == null || value === '' ? null : Number(value);
    if (id == null || !this.foodsInSelectedCategory().some((f) => f.id === id)) {
      this.selectedFoodId.set(null);
      return;
    }
    this.selectedFoodId.set(id);
  }

  onBeverageChange(value: number | string | null): void {
    const id = value == null || value === '' ? null : Number(value);
    this.selectedBeverageId.set(
      id != null && this.beveragesRaw().some((b) => b.id === id) ? id : null,
    );
  }

  onCocktailChange(value: number | string | null): void {
    const id = value == null || value === '' ? null : Number(value);
    if (id == null || !this.cocktailsRaw().some((c) => c.id === id)) {
      this.selectedCocktailId.set(null);
      return;
    }
    this.selectedCocktailId.set(id);
    this.syncCocktailHostSelection();
  }

  onOrderCocktailRoleChange(value: number | string | null): void {
    const roleId = value == null || value === '' ? null : Number(value);
    if (roleId == null || !this.cocktailHostRoleOptions().some((o) => o.value === roleId)) return;
    this.orderCocktailStaffRoleId.set(roleId);
    this.orderCocktailStaffEmployeeId.set(null);
    this.syncCocktailHostSelection();
  }

  onOrderCocktailEmployeeChange(value: number | string | null): void {
    if (value == null || value === '') {
      this.orderCocktailStaffEmployeeId.set(null);
      return;
    }
    const id = Number(value);
    const valid = this.cocktailHostEmployeeOptions().some((o) => o.value === id);
    this.orderCocktailStaffEmployeeId.set(valid ? id : null);
  }

  onPromotionChange(value: number | string | null): void {
    const id = value == null || value === '' ? null : Number(value);
    this.selectedPromotionId.set(
      id != null && this.promotionsRaw().some((p) => p.id === id) ? id : null,
    );
  }

  onMembershipChange(value: number | string | null): void {
    const id = value == null || value === '' ? null : Number(value);
    this.selectedMembershipId.set(
      id != null && this.membershipsRaw().some((m) => m.id === id) ? id : null,
    );
  }

  onOtherChargeChange(value: number | string | null): void {
    const id = value == null || value === '' ? null : Number(value);
    this.selectedOtherChargeId.set(
      id != null && this.activeOtherCharges().some((c) => c.id === id) ? id : null,
    );
  }

  onOrderQtyTextChange(value: string): void {
    this.orderQtyText.set(sanitizeDigitsOnly(value));
  }

  onStaffLedgerRoleChange(value: number | string | null): void {
    const roleId = value == null || value === '' ? null : Number(value);
    if (roleId == null || !this.staffLedgerRoles().some((r) => r.id === roleId)) return;
    this.staffLedgerRoleId.set(roleId);
    this.staffLedgerEmployeeId.set(null);
    this.syncStaffLedgerEmployee();
    if (isEntertainmentStaffRole(this.staffLedgerRoles().find((r) => r.id === roleId)!)) {
      this.stampStaffSeatStartTime();
    }
  }

  onStaffLedgerEmployeeChange(value: number | string | null): void {
    if (value == null || value === '') {
      this.staffLedgerEmployeeId.set(null);
      return;
    }
    const id = Number(value);
    const valid = this.staffLedgerEmployees().some((e) => e.id === id);
    this.staffLedgerEmployeeId.set(valid ? id : null);
  }

  onStaffLedgerQtyTextChange(value: string): void {
    this.staffLedgerQtyText.set(sanitizeDigitsOnly(value));
  }

  private buildOrderLedgerPayload(): {
    items: AddItemsPayload['items'];
    staffDrinks: AddItemsPayload['staffDrinks'];
  } | null {
    const quantity = parsePositiveIntFromText(this.orderQtyText());
    const category = this.orderLedgerCategory();
    const items: AddItemsPayload['items'] = [];
    const staffDrinks: AddItemsPayload['staffDrinks'] = [];

    if (category === 'FOOD') {
      const foodId = this.selectedFoodId();
      if (foodId == null) {
        this.toast.showError('กรุณาเลือกรายการอาหาร');
        return null;
      }
      items.push({ itemId: foodId, quantity, type: 'FOOD' });
    } else if (category === 'BEVERAGE') {
      const beverageId = this.selectedBeverageId();
      if (beverageId == null) {
        this.toast.showError('กรุณาเลือกเครื่องดื่ม');
        return null;
      }
      items.push({ itemId: beverageId, quantity, type: 'DRINK' });
    } else if (category === 'COCKTAIL') {
      const cocktailId = this.selectedCocktailId();
      if (cocktailId == null) {
        this.toast.showError('กรุณาเลือกค็อกเทล');
        return null;
      }
      const hostId = this.orderCocktailStaffEmployeeId();
      if (hostId == null) {
        this.toast.showError('กรุณาเลือกพนักงานพ่วงดื่มสำหรับค็อกเทล');
        return null;
      }
      items.push({ itemId: cocktailId, quantity, type: 'COCKTAIL', hostEmployeeId: hostId });
    } else if (category === 'PROMOTION') {
      const promoId = this.selectedPromotionId();
      if (promoId == null) {
        this.toast.showError('กรุณาเลือกโปรโมชั่น');
        return null;
      }
      items.push({ itemId: promoId, quantity, type: 'PROMOTION' });
    } else if (category === 'MEMBER') {
      const memberId = this.selectedMembershipId();
      if (memberId == null) {
        this.toast.showError('กรุณาเลือกแพ็กเกจสมาชิก');
        return null;
      }
      items.push({ itemId: memberId, quantity, type: 'MEMBERSHIP' });
    } else if (category === 'OTHER') {
      const otherId = this.selectedOtherChargeId();
      if (otherId == null) {
        this.toast.showError('กรุณาเลือกรายการอื่นๆ');
        return null;
      }
      items.push({ itemId: otherId, quantity, type: 'OTHER' });
    } else {
      this.toast.showError('หมวดการลงรายการไม่ถูกต้อง');
      return null;
    }

    return { items, staffDrinks };
  }

  private buildStaffLedgerPayload(): AddItemsPayload['staffDrinks'] | null {
    const employeeId = this.staffLedgerEmployeeId();
    if (employeeId == null) {
      this.toast.showError('กรุณาเลือกพนักงาน');
      return null;
    }
    if (!this.staffLedgerEmployees().some((e) => e.id === employeeId)) {
      this.toast.showError('พนักงานไม่ตรงกับตำแหน่งที่เลือก');
      return null;
    }

    const role = this.selectedStaffLedgerRole();
    if (!role) {
      this.toast.showError('กรุณาเลือกตำแหน่งพนักงาน');
      return null;
    }

    if (isEntertainmentStaffRole(role)) {
      const seatLocal = this.staffSeatStartedAt().trim();
      if (!isValidShopDatetimeLocal(seatLocal)) {
        this.toast.showError('กรุณาระบุเวลาเริ่มนั่งโต๊ะ');
        return null;
      }
      return [{ employeeId, quantity: 0, seatStartedAt: seatLocal }];
    }

    const quantity = parsePositiveIntFromText(this.staffLedgerQtyText());
    return [{ employeeId, quantity }];
  }

  setTypeFilter(value: SeatTypeFilter): void {
    this.typeFilter.set(value);
  }

  setStatusFilter(value: SeatStatusFilter): void {
    this.statusFilter.set(value);
  }

  selectSeat(seat: SeatTile): void {
    if (this.anyModalOpen()) return;
    this.selectedSeatKey.set(seat.key);
    this.showMobileSheet.set(true);
    if (seat.sessionId) {
      this.loadSessionDetail(seat.sessionId, { showLoading: true });
    } else {
      this.sessionDetail.set(null);
      this.sessionDetailLoading.set(false);
      const defaultSale = this.saleEmployees()[0]?.id ?? null;
      this.checkInSalesId.set(defaultSale);
    }
  }

  closeDrawer(): void {
    this.selectedSeatKey.set(null);
    this.sessionDetail.set(null);
    this.sessionDetailLoading.set(false);
    this.sessionDetailRequestSeq += 1;
    this.showMobileSheet.set(false);
  }

  closeMobileSheet(): void {
    this.closeDrawer();
  }

  onCheckInSalesChange(value: number | string | null): void {
    const id = value == null || value === '' ? null : Number(value);
    this.checkInSalesId.set(Number.isFinite(id) ? id : null);
  }

  onTransferSeatingTypeChange(value: number | string | null): void {
    const typeId =
      value == null || value === '' ? null : Number(value);
    if (typeId == null || !Number.isFinite(typeId)) {
      this.transferSeatingTypeId.set(null);
      this.transferDestinationKey.set(null);
      return;
    }
    this.transferSeatingTypeId.set(typeId);
    const firstDest = this.availableTransferTargets().find(
      (t) => t.seatingTypeId === typeId,
    );
    this.transferDestinationKey.set(firstDest?.key ?? null);
  }

  onTransferDestinationChange(value: number | string | null): void {
    if (value == null || value === '') {
      this.transferDestinationKey.set(null);
      return;
    }
    this.transferDestinationKey.set(String(value));
  }

  private initTransferModal(): boolean {
    const types = this.transferTypesWithAvailability();
    if (types.length === 0) {
      this.toast.showError('ไม่มีที่นั่งว่างให้ย้าย');
      return false;
    }
    const firstType = types[0];
    this.transferSeatingTypeId.set(firstType.id);
    const firstDest = this.availableTransferTargets().find(
      (t) => t.seatingTypeId === firstType.id,
    );
    this.transferDestinationKey.set(firstDest?.key ?? null);
    return true;
  }

  /** Screen-reader / title only — floor plan uses color, not this label. */
  statusText(status: SeatStatus): string {
    if (status === 'AVAILABLE') return 'ว่าง';
    if (status === 'AWAITING_CLEAR') return 'รอเคลียโต๊ะ';
    return 'มีลูกค้า';
  }

  seatTileClasses(seat: SeatTile): Record<string, boolean> {
    return {
      'open-table-seat-tile': true,
      'open-table-seat-tile--available': seat.status === 'AVAILABLE',
      'open-table-seat-tile--occupied': seat.status === 'OCCUPIED',
      'open-table-seat-tile--awaiting-clear': seat.status === 'AWAITING_CLEAR',
      'open-table-seat-tile--selected': this.selectedSeatKey() === seat.key,
    };
  }

  statusDotClass(status: SeatStatus): Record<string, boolean> {
    return {
      'open-table-status-dot': true,
      'open-table-status-dot--available': status === 'AVAILABLE',
      'open-table-status-dot--occupied': status === 'OCCUPIED',
      'open-table-status-dot--awaiting-clear': status === 'AWAITING_CLEAR',
    };
  }

  async checkInSelectedSeat(): Promise<void> {
    const seat = this.selectedSeat();
    const salesId = this.checkInSalesId();
    if (!seat || salesId == null) {
      this.toast.showError('กรุณาเลือกเซลล์');
      return;
    }

    const saleName =
      this.saleEmployees().find((e) => e.id === salesId)?.nickname ?? '—';
    const ok = await this.confirmDialog.confirm({
      title: 'เปิดโต๊ะ',
      message: `เปิด ${seat.zoneLabel} · ${seat.code} เซลล์ ${saleName} ใช่หรือไม่?`,
      confirmLabel: 'เปิดโต๊ะ',
    });
    if (!ok) return;

    this.runAction(
      this.openTableService.openTable({
        shopId: this.shopId,
        salesId,
        seatingId: seat.seatId,
      }),
      'เปิดโต๊ะสำเร็จ',
      (session) => {
        this.applySeatCheckIn(seat.key, session.id, saleName, session.revision ?? 1);
        this.refreshFloorPlan(seat.key, { silent: true });
      },
      () => {
        this.refreshFloorPlan(this.selectedSeatKey(), { silent: true });
      },
    );
  }

  openAddItemModal(): void {
    const sessionId = this.selectedSeat()?.sessionId;
    if (!sessionId) {
      this.toast.showError('กรุณาเปิดโต๊ะก่อนเพิ่มรายการ');
      return;
    }
    if (!this.ledgerCanMutate()) {
      this.toast.showError('เช็กบิลแล้ว — ไม่สามารถเพิ่มรายการได้');
      return;
    }
    this.showMobileSheet.set(false);
    this.addModalMode.set('ORDER_LEDGER');
    this.syncStaffLedgerRoles();
    this.resetOrderLedgerForm();
    this.resetStaffLedgerForm();
    this.showAddModal.set(true);
  }

  closeAddModal(): void {
    this.showAddModal.set(false);
    if (this.selectedSeatKey()) {
      this.showMobileSheet.set(true);
    }
  }

  submitAddItems(): void {
    if (!this.ledgerCanMutate()) {
      this.toast.showError('เช็กบิลแล้ว — ไม่สามารถเพิ่มรายการได้');
      this.closeAddModal();
      return;
    }
    const sessionId = this.selectedSeat()?.sessionId;
    const expectedRevision = this.requireExpectedRevision();
    if (!sessionId || expectedRevision == null) {
      if (!sessionId) this.toast.showError('ไม่พบเซสชัน');
      return;
    }

    let items: AddItemsPayload['items'] = [];
    let staffDrinks: AddItemsPayload['staffDrinks'] = [];

    if (this.addModalMode() === 'ORDER_LEDGER') {
      const orderPayload = this.buildOrderLedgerPayload();
      if (!orderPayload) return;
      items = orderPayload.items;
      staffDrinks = orderPayload.staffDrinks;
    } else {
      const ledgerPayload = this.buildStaffLedgerPayload();
      if (!ledgerPayload) return;
      staffDrinks = ledgerPayload;
    }

    const successMessage =
      this.addModalMode() === 'ORDER_LEDGER'
        ? 'เพิ่มรายการลงโต๊ะสำเร็จ'
        : 'บันทึกรันดื่มพนักงานสำเร็จ';

    this.runAction(
      this.openTableService.addOrderItems({
        shopId: this.shopId,
        sessionId,
        expectedRevision,
        items,
        staffDrinks,
      }),
      successMessage,
      () => {
        this.closeAddModal();
        this.loadSessionDetail(sessionId, { showLoading: false });
        if (staffDrinks.length > 0) {
          this.reloadStaffEmployees();
        }
      },
    );
  }

  handleSeatTransfer(): void {
    const seat = this.selectedSeat();
    if (!seat?.sessionId) {
      this.toast.showError('ย้ายได้เฉพาะโต๊ะหรือห้องที่มีลูกค้า');
      return;
    }
    this.showMobileSheet.set(false);
    if (!this.initTransferModal()) return;
    this.showTransferModal.set(true);
  }

  closeTransferModal(): void {
    this.showTransferModal.set(false);
    if (this.selectedSeatKey()) {
      this.showMobileSheet.set(true);
    }
  }

  submitTransfer(): void {
    const seat = this.selectedSeat();
    const destKey = this.transferDestinationKey();
    const destination = destKey ? this.seats().find((s) => s.key === destKey) : null;
    const expectedRevision = this.requireExpectedRevision();
    if (!seat?.sessionId || !destination || expectedRevision == null) {
      this.toast.showError('กรุณาเลือกปลายทาง');
      return;
    }
    this.runAction(
      this.openTableService.transferSeat({
        shopId: this.shopId,
        sessionId: seat.sessionId,
        expectedRevision,
        sourceSeatingId: seat.seatId,
        destinationSeatingId: destination.seatId,
      }),
      'ย้ายสำเร็จ',
      () => {
        this.closeTransferModal();
        this.selectedSeatKey.set(destination.key);
        this.refreshFloorPlan(destination.key);
      },
    );
  }

  openStopRoomModal(row: SessionRoomCharge): void {
    this.stopRoomTarget.set(row);
    this.stopSeatTime.set(currentDatetimeLocalValue());
    this.showStopRoomModal.set(true);
    this.showMobileSheet.set(false);
  }

  closeStopRoomModal(): void {
    closeOpenShopFlatpickrCalendars();
    this.showStopRoomModal.set(false);
    this.stopRoomTarget.set(null);
    if (this.selectedSeatKey()) {
      this.showMobileSheet.set(true);
    }
  }

  confirmStopRoom(): void {
    const sessionId = this.selectedSeat()?.sessionId;
    const expectedRevision = this.requireExpectedRevision();
    const row = this.stopRoomTarget();
    if (!sessionId || !row || expectedRevision == null) {
      this.toast.showError('ไม่พบรายการห้อง');
      return;
    }
    const seatStoppedAt = this.stopSeatTime().trim();
    if (!isValidShopDatetimeLocal(seatStoppedAt)) {
      this.toast.showError('กรุณาระบุเวลาสต็อป');
      return;
    }
    this.runAction(
      this.openTableService.stopRoomCharge({
        shopId: this.shopId,
        sessionId,
        expectedRevision,
        roomChargeId: row.roomChargeId,
        seatStoppedAt,
      }),
      'สต็อปห้องสำเร็จ',
      () => {
        this.closeStopRoomModal();
        this.loadSessionDetail(sessionId, { showLoading: false });
      },
      () => {
        this.closeStopRoomModal();
        this.loadSessionDetail(sessionId, { showLoading: false });
      },
    );
  }

  openStopDrinkModal(row: SessionStaffDrink): void {
    this.stopDrinkTarget.set(row);
    this.stopSeatTime.set(currentDatetimeLocalValue());
    this.showStopDrinkModal.set(true);
    this.showMobileSheet.set(false);
  }

  closeStopDrinkModal(): void {
    closeOpenShopFlatpickrCalendars();
    this.showStopDrinkModal.set(false);
    this.stopDrinkTarget.set(null);
    if (this.selectedSeatKey()) {
      this.showMobileSheet.set(true);
    }
  }

  confirmStopDrink(): void {
    const sessionId = this.selectedSeat()?.sessionId;
    const expectedRevision = this.requireExpectedRevision();
    const row = this.stopDrinkTarget();
    if (!sessionId || !row || expectedRevision == null) {
      this.toast.showError('ไม่พบรายการรันดื่ม');
      return;
    }
    const seatStoppedAt = this.stopSeatTime().trim();
    if (!isValidShopDatetimeLocal(seatStoppedAt)) {
      this.toast.showError('กรุณาระบุเวลาสต็อป');
      return;
    }
    this.runAction(
      this.openTableService.stopStaffDrink({
        shopId: this.shopId,
        sessionId,
        expectedRevision,
        staffDrinkId: row.staffDrinkId,
        seatStoppedAt,
      }),
      'สต็อปดื่มสำเร็จ',
      () => {
        this.closeStopDrinkModal();
        this.loadSessionDetail(sessionId, { showLoading: false });
        this.reloadStaffEmployees();
      },
      () => {
        this.closeStopDrinkModal();
        this.loadSessionDetail(sessionId, { showLoading: false });
      },
    );
  }

  openReturnBeverageModal(item: SessionOrderItem): void {
    this.returnBeverageTarget.set(item);
    this.returnBeverageQtyText.set('1');
    this.showReturnBeverageModal.set(true);
    this.showMobileSheet.set(false);
  }

  closeReturnBeverageModal(): void {
    this.showReturnBeverageModal.set(false);
    this.returnBeverageTarget.set(null);
    if (this.selectedSeatKey()) {
      this.showMobileSheet.set(true);
    }
  }

  onReturnBeverageQtyChange(value: string): void {
    this.returnBeverageQtyText.set(sanitizeDigitsOnly(value));
  }

  confirmReturnBeverage(): void {
    const sessionId = this.selectedSeat()?.sessionId;
    const expectedRevision = this.requireExpectedRevision();
    const item = this.returnBeverageTarget();
    if (!sessionId || !item || expectedRevision == null) {
      this.toast.showError('ไม่พบรายการเครื่องดื่ม');
      return;
    }
    const quantity = parsePositiveIntFromText(this.returnBeverageQtyText());
    if (quantity == null || quantity <= 0) {
      this.toast.showError('กรุณาระบุจำนวนคืน');
      return;
    }
    if (quantity > item.quantity) {
      this.toast.showError(`คืนได้ไม่เกิน ${item.quantity} ${item.unitLabel}`);
      return;
    }
    this.runAction(
      this.openTableService.returnBeverage({
        shopId: this.shopId,
        sessionId,
        expectedRevision,
        itemId: item.itemId,
        unitPrice: item.unitPrice,
        isFreeMixer: Boolean(item.isFreeMixer),
        quantity,
      }),
      'คืนเครื่องดื่มสำเร็จ',
      () => {
        this.closeReturnBeverageModal();
        this.loadSessionDetail(sessionId, { showLoading: false });
      },
      () => {
        this.closeReturnBeverageModal();
        this.loadSessionDetail(sessionId, { showLoading: false });
      },
    );
  }

  openCheckoutModal(): void {
    this.checkoutAt.set(currentDatetimeLocalValue());
    this.checkoutPreview.set(null);
    this.showCheckoutModal.set(true);
    this.showMobileSheet.set(false);
    this.scheduleCheckoutPreview();
  }

  closeCheckoutModal(): void {
    closeOpenShopFlatpickrCalendars();
    if (this.checkoutPreviewTimer != null) {
      clearTimeout(this.checkoutPreviewTimer);
      this.checkoutPreviewTimer = null;
    }
    this.checkoutPreview.set(null);
    this.showCheckoutModal.set(false);
    if (this.selectedSeatKey()) {
      this.showMobileSheet.set(true);
    }
  }

  onCheckoutAtChange(value: string): void {
    this.checkoutAt.set(value);
    this.scheduleCheckoutPreview();
  }

  private scheduleCheckoutPreview(): void {
    if (this.checkoutPreviewTimer != null) {
      clearTimeout(this.checkoutPreviewTimer);
    }
    this.checkoutPreviewTimer = setTimeout(() => {
      this.checkoutPreviewTimer = null;
      this.loadCheckoutPreview();
    }, 350);
  }

  private loadCheckoutPreview(): void {
    const sessionId = this.selectedSeat()?.sessionId;
    const checkedOutAt = this.checkoutAt().trim();
    if (!sessionId || !isValidShopDatetimeLocal(checkedOutAt)) {
      this.checkoutPreview.set(null);
      return;
    }
    this.checkoutPreviewLoading.set(true);
    this.openTableService
      .previewCheckout({ shopId: this.shopId, sessionId, checkedOutAt })
      .pipe(
        catchError((err: { error?: { error?: string } }) => {
          this.checkoutPreview.set(null);
          const msg = err.error?.error;
          if (msg) this.toast.showError(msg);
          return of(null);
        }),
        finalize(() => this.checkoutPreviewLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((preview) => {
        if (preview) this.checkoutPreview.set(preview);
      });
  }

  confirmCheckout(): void {
    const sessionId = this.selectedSeat()?.sessionId;
    const expectedRevision = this.requireExpectedRevision();
    if (!sessionId || expectedRevision == null) {
      this.toast.showError('ไม่พบบิลที่เปิดอยู่');
      return;
    }
    const checkedOutAt = this.checkoutAt().trim();
    if (!isValidShopDatetimeLocal(checkedOutAt)) {
      this.toast.showError('กรุณาระบุเวลาเช็กบิล');
      return;
    }

    this.runAction(
      this.openTableService.checkoutBill({
        shopId: this.shopId,
        sessionId,
        expectedRevision,
        checkedOutAt,
        releaseSeat: false,
      }),
      'เช็กบิลสำเร็จ',
      (result) => {
        this.closeCheckoutModal();
        const seatKey = this.selectedSeatKey();
        if (result.sessionClosed) {
          this.closeAddModal();
          this.closeDrawer();
          this.refreshFloorPlan(null);
          return;
        }
        if (seatKey) {
          this.applySeatAfterCheckout(seatKey, sessionId, result.checkedOutLabel);
          this.loadSessionDetail(sessionId, { showLoading: false });
          this.refreshFloorPlan(seatKey, { silent: true });
        }
      },
      () => {
        this.closeCheckoutModal();
        this.closeAddModal();
      },
    );
  }

  async releaseCustomerFromSeat(): Promise<void> {
    const sessionId = this.selectedSeat()?.sessionId;
    const expectedRevision = this.requireExpectedRevision();
    if (!sessionId || expectedRevision == null) {
      this.toast.showError('ไม่พบบิลที่เปิดอยู่');
      return;
    }

    const restoreMobileSheet = this.showMobileSheet();
    this.showMobileSheet.set(false);

    const ok = await this.confirmDialog.confirm({
      title: 'ลูกค้ากลับแล้ว',
      message: 'ยืนยันว่าลูกค้าออกจากโต๊ะแล้ว และปล่อยที่นั่งให้ว่าง?',
    });
    if (!ok) {
      if (restoreMobileSheet && this.selectedSeatKey()) {
        this.showMobileSheet.set(true);
      }
      return;
    }

    this.runAction(
      this.openTableService.releaseCustomer({
        shopId: this.shopId,
        sessionId,
        expectedRevision,
      }),
      'ปล่อยโต๊ะแล้ว',
      () => {
        this.closeDrawer();
        this.refreshFloorPlan(null);
      },
    );
  }

  private runAction<T>(
    request$: import('rxjs').Observable<T>,
    successMessage: string,
    onSuccess: (result: T) => void,
    onError?: () => void,
  ): void {
    if (this.actionBusy()) return;
    this.actionBusy.set(true);
    request$
      .pipe(
        catchError((err: unknown) => {
          const httpErr = err instanceof HttpErrorResponse ? err : null;
          const msg =
            (httpErr?.error as { error?: string } | undefined)?.error ??
            'เกิดข้อผิดพลาด';
          this.toast.showError(msg);
          if (httpErr?.status === 409) {
            this.onMutationConflict();
          }
          return of(null);
        }),
        finalize(() => this.actionBusy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (result == null) {
          onError?.();
          return;
        }
        this.toast.showSuccess(successMessage);
        onSuccess(result);
      });
  }
}
