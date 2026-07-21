import { CommonModule, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { catchError, finalize, forkJoin, of } from 'rxjs';

import { AppModalComponent, type AppModalLayout } from '../../components/app-modal/app-modal.component';
import { PortalToBodyDirective } from '../../directives/portal-to-body.directive';
import {
  APP_MODAL_BODY_LOCK_CLASS,
  OPEN_TABLE_MOBILE_SHEET_BODY_LOCK_CLASS,
} from '../../utils/body-portal.util';
import { ShopDatetimeInputComponent } from '../../components/shop-datetime-input/shop-datetime-input.component';
import {
  CustomDropdownComponent,
  type DropdownOption,
} from '../../components/custom-dropdown/custom-dropdown.component';
import type { MstEmployee } from '../../models/employee';
import type { MstFood, MstFoodCategory, MstMembership, MstPromotion } from '../../models/master-data';
import { drinkPackageItemsSummary } from '../../utils/drink-package.util';
import type { PackageDepositRecord, PackageOpenMode } from '../../models/package-deposit';
import type { MstRole } from '../../models/role';
import type { BillReceiptResponse } from '../../models/bill-receipt';
import type {
  AddItemsPayload,
  CheckoutPreview,
  CheckoutResult,
  FloorPlanKpi,
  FloorPlanSeatLayout,
  StopStaffDrinkPreview,
  OpenTableSessionDetail,
  PackageBottleMoveLine,
  SeatStatus,
  SessionOrderItem,
  SessionRoomCharge,
  SessionStaffDrink,
} from '../../models/open-table';
import { floorLayoutSeatBoxStyle } from '../../models/seating-floor-layout';
import type { SeatingRateType } from '../../models/seating';
import {
  ROOM_CHARGE_MODE_OPTIONS,
  type RoomChargeRateMode,
} from '../../models/room-charge';
import type { MstBeverage, MstBeverageCategory } from '../../models/beverage';
import type { MstOtherCharge } from '../../models/other-charge';
import { isMiscOtherCharge, isTableOpeningOtherCharge } from '../../models/other-charge';
import { isMixerCategoryKind } from '../../utils/beverage-category-kind.util';
import { OtherChargeService } from '../../services/other-charge.service';
import { PackageDepositService } from '../../services/package-deposit.service';
import {
  ORDER_LEDGER_CATEGORY_LABELS,
  ORDER_LEDGER_CATEGORY_VALUES,
  STAFF_LEDGER_ENTRY_MODE_OPTIONS,
  currentDatetimeLocalValue,
  formatShopDatetimeLabelBe,
  isEntertainmentStaffRole,
  isValidShopDatetimeLocal,
  isFixedDrinkStaffRole,
  splitShopDatetimeLocal,
  type OrderLedgerCategory,
  type StaffLedgerEntryMode,
} from './open-table-ledger.util';
import { AuthService } from '../../services/auth.service';
import { BeverageService } from '../../services/beverage.service';
import { EmployeeService } from '../../services/employee.service';
import { OpenTableService } from '../../services/open-table.service';
import { BillReceiptService } from '../../services/bill-receipt.service';
import { APP_MOBILE_MEDIA_QUERY } from '../../utils/app-viewport.util';
import { detectReceiptPrintPlatform } from '../../utils/receipt-print-platform.util';
import { RoleService } from '../../services/role.service';
import { ShopMasterService } from '../../services/shop-master.service';
import { ConfirmDialogService, CHANGE_REASON_MIN_LEN } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';
import { closeOpenShopFlatpickrCalendars } from '../../utils/flatpickr-shop.util';
import {
  LOCAL_CODE_VALIDATORS_HINT,
  normalizeLocalCodeForSubmit,
  trimLocalCodeInput,
} from '../../utils/local-code.util';
import {
  CHECKOUT_PAYMENT_METHOD_OPTIONS,
  billPaymentMethodLabel,
  isBillPaymentMethod,
  type BillPaymentMethod,
} from '../../utils/bill-payment-method.util';
import { compareRolesByThaiLabel, roleOptionLabel } from '../../utils/role-display.util';
import {
  employeeDropdownLabel,
  employeeMatchesBranchRole,
  sortEmployeesByCode,
} from '../../utils/employee-option.util';
import {
  blockNonNumericInputKey,
  parsePositiveIntFromText,
  sanitizeDigitsOnly,
} from '../../utils/numeric-input.util';

type SeatStatusFilter = 'ALL' | 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'AWAITING_CLEAR';
type CheckInMode = 'OPEN' | 'RESERVE';
type AddModalMode = 'ORDER_LEDGER' | 'STAFF_LEDGER' | 'ROOM_CHARGE';

/** PC left-rail entry points (order matches floor ops: staff/room first, then menu). */
type PcAddNavKey = AddModalMode | OrderLedgerCategory;

type PcAddNavItem = { key: PcAddNavKey; label: string; shortLabel: string };

const OWNER_ROLE = 'OWNER';

type SeatingTypeZone = { id: number; name: string; rateType: SeatingRateType };

type SeatTile = {
  key: string;
  seatId: number;
  code: string;
  seatingTypeId: number;
  chargesRoomFee: boolean;
  zoneLabel: string;
  status: SeatStatus;
  sessionId: number | null;
  sessionRevision: number | null;
  saleName?: string;
  reservedSaleId?: number | null;
  reservedCreditSaleToShop?: boolean;
  reservedOperatorName?: string | null;
  guestCount?: number | null;
  creditSaleToShop?: boolean;
  operatorSaleName?: string | null;
  previewTotalAmount?: number | null;
  openDurationLabel?: string | null;
  reservedTimeLabel?: string | null;
  floorLayout?: FloorPlanSeatLayout | null;
};

type FloorDisplayMode = 'grid' | 'layout';

const FLOOR_DISPLAY_MODE_KEY = 'dod.openTable.floorDisplayMode';

@Component({
  selector: 'app-open-table-page',
  imports: [
    CommonModule,
    DecimalPipe,
    FormsModule,
    AppModalComponent,
    CustomDropdownComponent,
    PortalToBodyDirective,
    ShopDatetimeInputComponent,
  ],
  templateUrl: './open-table-page.component.html',
  styleUrl: './open-table-page.component.css',
})
export class OpenTablePageComponent implements OnInit {
  readonly openTableMobileSheetBodyLockClass = OPEN_TABLE_MOBILE_SHEET_BODY_LOCK_CLASS;

  private readonly destroyRef = inject(DestroyRef);
  private readonly openTableService = inject(OpenTableService);
  private readonly billReceiptService = inject(BillReceiptService);
  private readonly shopMaster = inject(ShopMasterService);
  private readonly otherChargeService = inject(OtherChargeService);
  private readonly packageDepositService = inject(PackageDepositService);
  private readonly beverageService = inject(BeverageService);
  private readonly employeeService = inject(EmployeeService);
  private readonly roleService = inject(RoleService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly loading = signal(true);
  readonly floorPlanRefreshing = signal(false);
  readonly floorPlanSkeleton = computed(() => this.loading() || this.floorPlanRefreshing());
  readonly seatSkeletonSlots = Array.from({ length: 16 }, (_, i) => i);
  readonly actionBusy = signal(false);
  readonly search = signal('');
  readonly seatingTypeZones = signal<SeatingTypeZone[]>([]);
  readonly floorPlanKpi = signal<FloorPlanKpi>({
    totalSeats: 0,
    available: 0,
    availablePct: 0,
    inUse: 0,
    inUsePct: 0,
    reserved: 0,
    reservedPct: 0,
    todaySales: 0,
    salesChangePct: null,
  });
  readonly statusFilter = signal<SeatStatusFilter>('ALL');
  readonly floorDisplayMode = signal<FloorDisplayMode>(readFloorDisplayMode());
  readonly floorCanvas = signal<{ width: number; height: number }>({ width: 1200, height: 800 });
  readonly checkInGuestCountText = signal('1');
  readonly selectedSeatKey = signal<string | null>(null);
  readonly showMobileSheet = signal(false);
  /** Mobile sheet + body scroll lock below 1000px. */
  private readonly mobileDrawerViewport = signal(
    typeof window !== 'undefined'
      ? window.matchMedia(APP_MOBILE_MEDIA_QUERY).matches
      : false,
  );
  readonly showMobileSheetLayer = computed(
    () =>
      this.mobileDrawerViewport() &&
      this.showMobileSheet() &&
      this.selectedSeat() != null &&
      !this.anyModalOpen(),
  );
  /** Stop / checkout dialogs slide up from bottom on phone. */
  readonly actionModalLayout = computed((): AppModalLayout =>
    this.mobileDrawerViewport() ? 'sheet' : 'center',
  );
  readonly sessionDetail = signal<OpenTableSessionDetail | null>(null);
  readonly sessionDetailLoading = signal(false);
  /** Skeleton while reserving / cancelling reservation (no session bill yet). */
  readonly seatPanelLoading = signal(false);
  /** Stable keys for `@for` in bill skeleton (avoid allocating each change detection). */
  readonly billSkeletonLines = [1, 2, 3] as const;
  private sessionDetailRequestSeq = 0;
  private pendingSessionFocus: number | null = null;

  readonly showAddModal = signal(false);
  readonly showTransferModal = signal(false);
  readonly showStopDrinkModal = signal(false);
  readonly showStopRoomModal = signal(false);
  readonly showReturnBeverageModal = signal(false);
  readonly showVoidItemModal = signal(false);
  readonly showDeleteStaffDrinkModal = signal(false);
  readonly showEditStaffDrinkModal = signal(false);
  readonly showDeleteRoomChargeModal = signal(false);
  readonly showEditRoomChargeModal = signal(false);
  readonly showPackageBottleModal = signal(false);
  readonly showCheckoutModal = signal(false);
  readonly showEditGuestCountModal = signal(false);
  readonly showEditCreditSaleModal = signal(false);
  readonly editGuestCountText = signal('1');
  readonly editCreditSaleToShop = signal(false);
  readonly sessionInfoEditTarget = signal<SeatTile | null>(null);
  readonly checkoutAt = signal(currentDatetimeLocalValue());
  readonly checkoutPaymentMethod = signal<BillPaymentMethod>('CASH');
  readonly checkoutPaymentMethodOptions = CHECKOUT_PAYMENT_METHOD_OPTIONS;
  readonly checkoutPreview = signal<CheckoutPreview | null>(null);
  readonly checkoutPreviewLoading = signal(false);
  readonly checkoutPrintBusy = signal(false);
  readonly lastCheckoutBillId = signal<number | null>(null);
  private checkoutPreviewTimer: ReturnType<typeof setTimeout> | null = null;
  readonly stopDrinkTarget = signal<SessionStaffDrink | null>(null);
  readonly stopDrinkPreview = signal<StopStaffDrinkPreview | null>(null);
  readonly stopDrinkPreviewLoading = signal(false);
  private stopDrinkPreviewTimer: ReturnType<typeof setTimeout> | null = null;
  readonly stopRoomTarget = signal<SessionRoomCharge | null>(null);
  readonly deleteRoomChargeTarget = signal<SessionRoomCharge | null>(null);
  readonly editRoomChargeTarget = signal<SessionRoomCharge | null>(null);
  readonly editRoomChargeRateType = signal<RoomChargeRateMode>('NONE');
  readonly editRoomChargeUnitPriceText = signal('');
  readonly returnBeverageTarget = signal<SessionOrderItem | null>(null);
  readonly returnBeverageQtyText = signal('1');
  readonly voidItemTarget = signal<SessionOrderItem | null>(null);
  readonly voidItemQtyText = signal('1');
  readonly deleteStaffDrinkTarget = signal<SessionStaffDrink | null>(null);
  readonly editStaffDrinkTarget = signal<SessionStaffDrink | null>(null);
  readonly editStaffDrinkQtyText = signal('1');
  readonly packageBottleAction = signal<'WITHDRAW' | 'DEPOSIT'>('WITHDRAW');
  readonly packageBottleBillItemKey = signal<string | null>(null);
  readonly packageBottleDisplayNameText = signal('');
  readonly packageBottleQtyText = signal('1');
  readonly mutationChangeReason = signal('');
  readonly mutationReasonValidated = signal(false);
  readonly stopSeatTime = signal(currentDatetimeLocalValue());
  private readonly stopDatetimeInput = viewChild('stopDatetimeInput', {
    read: ShopDatetimeInputComponent,
  });
  private readonly checkoutDatetimeInput = viewChild('checkoutDatetimeInput', {
    read: ShopDatetimeInputComponent,
  });
  private readonly staffSeatDatetimeInput = viewChild('staffSeatDatetimeInput', {
    read: ShopDatetimeInputComponent,
  });
  private readonly roomSeatDatetimeInput = viewChild('roomSeatDatetimeInput', {
    read: ShopDatetimeInputComponent,
  });
  readonly addModalMode = signal<AddModalMode>('ORDER_LEDGER');

  readonly seats = signal<SeatTile[]>([]);
  readonly saleEmployees = signal<MstEmployee[]>([]);
  readonly checkInSalesId = signal<number | null>(null);
  readonly checkInCreditSaleToShop = signal(false);
  readonly checkInMode = signal<CheckInMode>('OPEN');
  private readonly openTableOtherChargesRaw = signal<MstOtherCharge[]>([]);
  /** Standalone toggles + one id per choice group. */
  private readonly foodCategoriesRaw = signal<MstFoodCategory[]>([]);
  private readonly foodsRaw = signal<MstFood[]>([]);
  private readonly beverageCategoriesRaw = signal<MstBeverageCategory[]>([]);
  private readonly beveragesRaw = signal<MstBeverage[]>([]);
  private readonly cocktailsRaw = signal<{ id: number; name: string; drinkValue: number }[]>([]);
  private readonly promotionsRaw = signal<MstPromotion[]>([]);
  private readonly membershipsRaw = signal<MstMembership[]>([]);
  private readonly packageDepositsRaw = signal<PackageDepositRecord[]>([]);
  readonly staffEmployees = signal<MstEmployee[]>([]);
  /** All positions from master MstRole table (excludes OWNER in dropdowns). */
  private readonly masterRolesFromApi = signal<MstRole[]>([]);
  readonly staffLedgerRoles = signal<MstRole[]>([]);

  readonly orderLedgerCategory = signal<OrderLedgerCategory>('FOOD');
  readonly selectedFoodCategoryId = signal<number | null>(null);
  readonly selectedFoodId = signal<number | null>(null);
  readonly selectedBeverageCategoryId = signal<number | null>(null);
  readonly selectedBeverageId = signal<number | null>(null);
  /** When adding mixer drink: operator chooses free vs paid (not from mem/promo). */
  readonly beverageIsFreeMixer = signal(false);
  readonly selectedCocktailId = signal<number | null>(null);
  readonly selectedPromotionId = signal<number | null>(null);
  readonly selectedMembershipId = signal<number | null>(null);
  readonly selectedOtherChargeId = signal<number | null>(null);
  readonly orderCocktailStaffRoleId = signal<number | null>(null);
  readonly orderCocktailStaffEmployeeId = signal<number | null>(null);
  readonly orderQtyText = signal('1');
  readonly packageOpenMode = signal<PackageOpenMode>('NEW');
  readonly packageCustomerCode = signal('');
  readonly packageCustomerName = signal('');
  readonly selectedPackageDepositId = signal<number | null>(null);

  readonly staffLedgerEntryMode = signal<StaffLedgerEntryMode>('REGULAR');
  readonly staffLedgerEntryModeOptions: DropdownOption[] = STAFF_LEDGER_ENTRY_MODE_OPTIONS.map(
    (o) => ({ value: o.value, label: o.label }),
  );
  readonly staffLedgerRoleId = signal<number | null>(null);
  readonly staffLedgerEmployeeId = signal<number | null>(null);
  readonly staffLedgerQtyText = signal('1');
  readonly staffSeatStartedAt = signal(currentDatetimeLocalValue());
  /** Charge start drinks when PR sits (role.startDrinks > 0). */
  readonly staffApplyStartDrinks = signal(true);
  /** After stop on this table: continue run vs new start with start drinks. */
  readonly staffReopenMode = signal<'CONTINUE' | 'NEW_START'>('CONTINUE');
  /** PR with active tag: bill drinks toward tag quota (default on). */
  readonly staffBillAsTag = signal(true);
  /** Use mem/promo free PR drink quota for this add (default off — cashier opts in). */
  readonly staffUsePackageFreeDrinks = signal(false);

  readonly packageFreeDrinksQuota = computed(
    () => this.sessionDetail()?.packageFreeDrinksQuota ?? 0,
  );

  readonly packageFreeDrinksRemaining = computed(
    () => this.sessionDetail()?.packageFreeDrinksRemaining ?? 0,
  );

  readonly roomChargeSeatingTypeId = signal<number | null>(null);
  readonly roomChargeSeatingId = signal<number | null>(null);
  readonly roomChargeRateType = signal<RoomChargeRateMode>('NONE');
  readonly roomChargeUnitPriceText = signal('');
  readonly roomSeatStartedAt = signal(currentDatetimeLocalValue());
  readonly roomChargeRateTypeOptions: DropdownOption[] = ROOM_CHARGE_MODE_OPTIONS.map((o) => ({
    value: o.value,
    label: o.label,
  }));
  readonly roomChargeShowsPriceInput = computed(
    () => this.roomChargeRateType() === 'HOURLY' || this.roomChargeRateType() === 'FLAT_RATE',
  );
  readonly editRoomChargeShowsPriceInput = computed(
    () => this.editRoomChargeRateType() === 'HOURLY' || this.editRoomChargeRateType() === 'FLAT_RATE',
  );

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

  readonly hasChargeableSeats = computed(() => this.seats().some((s) => s.chargesRoomFee));

  readonly seatingTypeIdsWithRoomCharge = computed(() => {
    const ids = new Set<number>();
    for (const seat of this.seats()) {
      if (seat.chargesRoomFee) ids.add(seat.seatingTypeId);
    }
    return ids;
  });

  readonly filteredSeats = computed(() => {
    const keyword = this.search().trim().toLowerCase();
    return this.seats().filter((seat) => {
      if (this.statusFilter() === 'AVAILABLE' && seat.status !== 'AVAILABLE') return false;
      if (this.statusFilter() === 'RESERVED' && seat.status !== 'RESERVED') return false;
      if (this.statusFilter() === 'OCCUPIED' && seat.status !== 'OCCUPIED') return false;
      if (this.statusFilter() === 'AWAITING_CLEAR' && seat.status !== 'AWAITING_CLEAR') {
        return false;
      }
      if (!keyword) return true;
      return [seat.code, seat.saleName ?? '', seat.zoneLabel].join(' ').toLowerCase().includes(keyword);
    });
  });

  readonly seatZones = computed(() => {
    const seats = this.filteredSeats();
    return this.seatingTypeZones()
      .map((zone) => ({
        typeId: zone.id,
        label: zone.name,
        seats: seats.filter((s) => s.seatingTypeId === zone.id),
      }))
      .filter((z) => z.seats.length > 0);
  });

  readonly hasFloorLayout = computed(() =>
    this.seats().some((seat) => seat.floorLayout != null),
  );

  readonly layoutZones = computed(() => {
    const byType = new Map<number, { typeId: number; label: string; count: number }>();
    for (const seat of this.seats()) {
      if (!seat.floorLayout) continue;
      const existing = byType.get(seat.seatingTypeId);
      if (existing) {
        existing.count += 1;
      } else {
        byType.set(seat.seatingTypeId, {
          typeId: seat.seatingTypeId,
          label: seat.zoneLabel,
          count: 1,
        });
      }
    }
    return [...byType.values()].sort((a, b) =>
      a.label.localeCompare(b.label, 'th', { numeric: true, sensitivity: 'base' }),
    );
  });

  readonly layoutZoneId = signal<number | null>(null);

  readonly layoutSeats = computed(() => {
    const zoneId = this.layoutZoneId();
    return this.filteredSeats().filter((seat) => {
      if (seat.floorLayout == null) return false;
      if (zoneId == null) return true;
      return seat.seatingTypeId === zoneId;
    });
  });

  readonly statusCounts = computed(() => {
    const seats = this.seats();
    let available = 0;
    let reserved = 0;
    let occupied = 0;
    let awaitingClear = 0;
    for (const seat of seats) {
      if (seat.status === 'AVAILABLE') available += 1;
      else if (seat.status === 'RESERVED') reserved += 1;
      else if (seat.status === 'OCCUPIED') occupied += 1;
      else if (seat.status === 'AWAITING_CLEAR') awaitingClear += 1;
    }
    return {
      ALL: seats.length,
      AVAILABLE: available,
      RESERVED: reserved,
      OCCUPIED: occupied,
      AWAITING_CLEAR: awaitingClear,
    };
  });

  readonly panelGuestLabel = computed(() => {
    const seat = this.selectedSeat();
    if (!seat) return null;
    const count = this.sessionDetail()?.guestCount ?? seat.guestCount;
    if (count != null && count > 0) return `${count} คน`;
    return null;
  });

  readonly panelDurationLabel = computed(() => {
    const seat = this.selectedSeat();
    if (!seat?.openDurationLabel) return null;
    return `เปิดโต๊ะมาแล้ว ${seat.openDurationLabel} ชม.`;
  });

  readonly checkInFormReady = computed(
    () =>
      this.checkInSalesId() != null &&
      parsePositiveIntFromText(this.checkInGuestCountText()) != null,
  );
  readonly checkInValidated = signal(false);
  readonly addItemValidated = signal(false);
  readonly stopSeatTimeValidated = signal(false);
  readonly checkInSalesMissing = computed(() => this.checkInSalesId() == null);
  readonly checkInGuestCountMissing = computed(
    () => parsePositiveIntFromText(this.checkInGuestCountText()) == null,
  );
  readonly stopSeatTimeMissing = computed(
    () => !isValidShopDatetimeLocal(this.stopSeatTime().trim()),
  );
  readonly selectedSeat = computed(() =>
    this.selectedSeatKey()
      ? (this.seats().find((s) => s.key === this.selectedSeatKey()) ?? null)
      : null,
  );
  readonly availableTransferTargets = computed(() =>
    this.seats().filter((s) => s.status === 'AVAILABLE' && s.key !== this.selectedSeatKey()),
  );
  readonly totalDrinks = computed(
    () => this.sessionBillTotals(this.sessionDetail()).totalDrinks,
  );
  readonly totalAmount = computed(
    () => this.sessionBillTotals(this.sessionDetail()).totalAmount,
  );

  itemLineTotal(item: { quantity: number; unitPrice: number }): number {
    return item.quantity * item.unitPrice;
  }

  /** ยอดรวมจากบรรทัดในบิล — ตรงกับที่แสดงในแผง (ไม่พึ่ง totalAmount จาก API อย่างเดียว) */
  private sessionBillTotals(detail: OpenTableSessionDetail | null): {
    totalDrinks: number;
    totalAmount: number;
  } {
    if (!detail) {
      return { totalDrinks: 0, totalAmount: 0 };
    }
    const totalAmount =
      detail.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) +
      (detail.roomCharges ?? []).reduce((sum, row) => sum + row.lineAmount, 0) +
      detail.staffDrinks.reduce((sum, row) => sum + row.drinkAmount, 0);
    const totalDrinks = detail.staffDrinks.reduce((sum, row) => sum + row.drinks, 0);
    return { totalDrinks, totalAmount };
  }

  private withSessionBillTotals(detail: OpenTableSessionDetail): OpenTableSessionDetail {
    const totals = this.sessionBillTotals(detail);
    return { ...detail, ...totals };
  }
  readonly drawerOpen = computed(() => this.selectedSeatKey() != null);

  /** Desktop (≥1000px): bill replaces floor plan. */
  readonly isPcBillWorkspace = computed(
    () => !this.mobileDrawerViewport() && this.drawerOpen(),
  );
  readonly anyModalOpen = computed(
    () =>
      this.showAddModal() ||
      this.showTransferModal() ||
      this.showStopDrinkModal() ||
      this.showStopRoomModal() ||
      this.showReturnBeverageModal() ||
      this.showVoidItemModal() ||
      this.showDeleteStaffDrinkModal() ||
      this.showEditStaffDrinkModal() ||
      this.showDeleteRoomChargeModal() ||
      this.showEditRoomChargeModal() ||
      this.showPackageBottleModal() ||
      this.showCheckoutModal() ||
      this.showEditGuestCountModal() ||
      this.showEditCreditSaleModal(),
  );

  /** มีลูกค้า = ยังเปิดบิลอยู่ (ไม่อิง API flag อย่างเดียว) */
  readonly seatLedgerOpen = computed(() => this.selectedSeat()?.status === 'OCCUPIED');

  readonly seatAwaitingClear = computed(
    () => this.selectedSeat()?.status === 'AWAITING_CLEAR',
  );

  /** Bill to reprint — from session API after refresh, or in-memory right after checkout. */
  readonly reprintBillId = computed(
    () => this.sessionDetail()?.billId ?? this.lastCheckoutBillId(),
  );

  readonly seatReserved = computed(() => this.selectedSeat()?.status === 'RESERVED');

  readonly openTableSelfBillOnly = computed(() => this.auth.openTableSelfBillOnly());

  readonly ledgerCanMutate = computed(() => {
    if (this.openTableSelfBillOnly()) return false;
    if (!this.seatLedgerOpen()) return false;
    const detail = this.sessionDetail();
    if (detail?.canMutateLedger === false) return false;
    if (detail?.sessionStatus === 'BILLED') return false;
    return true;
  });

  readonly packageBottleBillItems = computed(() =>
    (this.sessionDetail()?.items ?? []).filter((item) => item.canAdjustPackageBottles),
  );

  readonly packageBottleModalOptions = computed<DropdownOption[]>(() => {
    const action = this.packageBottleAction();
    return this.packageBottleBillItems()
      .filter((item) =>
        action === 'WITHDRAW' ? item.canWithdrawPackageBottle : item.canDepositPackageBottle,
      )
      .map((item) => ({
        value: this.billItemKey(item),
        label: `${item.itemType === 'MEMBERSHIP' ? 'เมม' : 'โปร'} ${item.label}`,
        hint: `${item.packageBottlesRemaining ?? 0}/${item.packageBottlesTotal ?? 0} ขวด`,
      }));
  });

  readonly saleEmployeeOptions = computed<DropdownOption[]>(() =>
    sortEmployeesByCode(this.saleEmployees()).map((e) => ({
      value: e.id,
      label: employeeDropdownLabel(e),
    })),
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
    if (this.activeMiscOtherCharges().length > 0) {
      options.push({ value: 'OTHER', label: ORDER_LEDGER_CATEGORY_LABELS.OTHER });
    }
    if (this.activeTableOpeningCharges().length > 0) {
      options.push({
        value: 'TABLE_OPENING',
        label: ORDER_LEDGER_CATEGORY_LABELS.TABLE_OPENING,
      });
    }
    return options;
  });

  /** Desktop add rail — fixed order; hide empty master categories. */
  readonly pcAddNavItems = computed<PcAddNavItem[]>(() => {
    const items: PcAddNavItem[] = [
      { key: 'STAFF_LEDGER', label: 'รันดื่ม', shortLabel: 'รันดื่ม' },
      { key: 'ROOM_CHARGE', label: 'ค่าห้อง', shortLabel: 'ค่าห้อง' },
    ];
    const shortByCategory: Partial<Record<OrderLedgerCategory, string>> = {
      FOOD: 'อาหาร',
      BEVERAGE: 'เครื่องดื่ม',
      COCKTAIL: 'ค็อกเทล',
      PROMOTION: 'โปร',
      MEMBER: 'เมม',
      OTHER: 'เบ็ดเตล็ด',
      TABLE_OPENING: 'ค่าเปิดโต๊ะ',
    };
    const order: OrderLedgerCategory[] = [
      'FOOD',
      'BEVERAGE',
      'COCKTAIL',
      'PROMOTION',
      'MEMBER',
      'OTHER',
      'TABLE_OPENING',
    ];
    const available = new Set(
      this.orderMasterCategoryOptions().map((o) => String(o.value) as OrderLedgerCategory),
    );
    for (const category of order) {
      if (!available.has(category)) continue;
      items.push({
        key: category,
        label: ORDER_LEDGER_CATEGORY_LABELS[category],
        shortLabel: shortByCategory[category] ?? ORDER_LEDGER_CATEGORY_LABELS[category],
      });
    }
    return items;
  });

  readonly pcAddNavActiveLabel = computed(() => {
    const active = this.pcAddNavItems().find((item) => this.isPcAddNavActive(item.key));
    return active?.label ?? 'เพิ่มรายการ';
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

  readonly beverageCategoryDropdownOptions = computed<DropdownOption[]>(() =>
    this.beverageCategoriesRaw().map((c) => ({ value: c.id, label: c.name })),
  );

  readonly beveragesInSelectedCategory = computed(() => {
    const categoryId = this.selectedBeverageCategoryId();
    if (categoryId == null) return [];
    return this.beveragesRaw().filter((b) => b.categoryId === categoryId);
  });

  readonly selectedBeverageIsMixer = computed(() => {
    const categoryId = this.selectedBeverageCategoryId();
    if (categoryId == null) return false;
    const category = this.beverageCategoriesRaw().find((c) => c.id === categoryId);
    return category != null && isMixerCategoryKind(category.kind);
  });

  readonly beverageDropdownOptions = computed<DropdownOption[]>(() =>
    this.beveragesInSelectedCategory().map((b) => ({
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
    const role = this.masterRolesForDropdown().find((r) => r.id === roleId);
    return sortEmployeesByCode(
      this.staffEmployees().filter((e) => employeeMatchesBranchRole(e, role)),
    ).map(
      (e) => ({
        value: e.id,
        label: employeeDropdownLabel(e),
      }),
    );
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

  readonly showPackageOpenMode = computed(
    () => this.orderLedgerCategory() === 'PROMOTION' || this.orderLedgerCategory() === 'MEMBER',
  );

  /** อันที่ฝาก — เปิดลงโต๊ะเท่านั้น เบิกขวดทำที่หน้ารายการ */
  readonly showOrderQtyField = computed(() => {
    if (!this.showPackageOpenMode()) return true;
    return this.packageOpenMode() !== 'DEPOSIT';
  });

  readonly selectedPackageAllowsDeposit = computed(() => {
    const category = this.orderLedgerCategory();
    if (category === 'PROMOTION') {
      const id = this.selectedPromotionId();
      return this.promotionsRaw().find((p) => p.id === id)?.allowDeposit ?? false;
    }
    if (category === 'MEMBER') {
      const id = this.selectedMembershipId();
      return this.membershipsRaw().find((m) => m.id === id)?.allowDeposit ?? false;
    }
    return false;
  });

  readonly packageDepositDropdownOptions = computed<DropdownOption[]>(() => {
    const category = this.orderLedgerCategory();
    const sourceType = category === 'PROMOTION' ? 'PROMOTION' : 'MEMBERSHIP';
    return this.packageDepositsRaw()
      .filter(
        (row) =>
          row.sourceType === sourceType &&
          row.status === 'OPEN' &&
          row.bottlesRemaining > 0 &&
          row.onOpenSessionId == null,
      )
      .map((row) => ({
        value: row.id,
        label: `${this.packageDepositOptionLabel(row)} — ${row.packageName}`,
      }));
  });

  readonly activeMiscOtherCharges = computed(() =>
    this.openTableOtherChargesRaw().filter((c) => c.isActive && isMiscOtherCharge(c)),
  );

  readonly activeTableOpeningCharges = computed(() =>
    this.openTableOtherChargesRaw().filter((c) => c.isActive && isTableOpeningOtherCharge(c)),
  );

  readonly otherChargesForSelectedCategory = computed(() => {
    const category = this.orderLedgerCategory();
    if (category === 'TABLE_OPENING') return this.activeTableOpeningCharges();
    if (category === 'OTHER') return this.activeMiscOtherCharges();
    return [];
  });

  readonly otherChargeDropdownOptions = computed<DropdownOption[]>(() =>
    this.otherChargesForSelectedCategory().map((c) => ({
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

    const filtered = this.staffEmployees().filter((e) => {
      if (!employeeMatchesBranchRole(e, role)) return false;
      return this.isStaffLedgerEmployeeSelectable(e, role);
    });
    return sortEmployeesByCode(filtered);
  });

  readonly staffLedgerEmployeeOptions = computed<DropdownOption[]>(() =>
    this.staffLedgerEmployees().map((e) => ({
      value: e.id,
      label: employeeDropdownLabel(e),
    })),
  );

  readonly isStaffLedgerOffDutyPurchase = computed(
    () => this.staffLedgerEntryMode() === 'OFF_DUTY_PURCHASE',
  );

  readonly selectedStaffLedgerEmployee = computed(() => {
    const id = this.staffLedgerEmployeeId();
    if (id == null) return null;
    return this.staffLedgerEmployees().find((e) => e.id === id) ?? null;
  });

  readonly showStaffBillAsTagToggle = computed(() => {
    const emp = this.selectedStaffLedgerEmployee();
    return emp?.hasActivePrTag === true;
  });

  readonly selectedStaffLedgerRole = computed(() => {
    const roleId = this.staffLedgerRoleId();
    if (roleId == null) return null;
    return this.staffLedgerRoles().find((r) => r.id === roleId) ?? null;
  });

  readonly showStaffFixedDrinkQty = computed(() => {
    if (this.isStaffLedgerOffDutyPurchase()) return true;
    const role = this.selectedStaffLedgerRole();
    return role != null && isFixedDrinkStaffRole(role);
  });

  readonly showStaffSeatStartTime = computed(() => {
    if (this.isStaffLedgerOffDutyPurchase()) return false;
    const role = this.selectedStaffLedgerRole();
    return role != null && isEntertainmentStaffRole(role);
  });

  readonly staffReopenStoppedRowOnSession = computed(() => {
    const employeeId = this.staffLedgerEmployeeId();
    if (employeeId == null) return null;
    const row = (this.sessionDetail()?.staffDrinks ?? []).find(
      (r) => r.employeeRecordId === employeeId && r.seatStoppedLabel,
    );
    return row ?? null;
  });

  readonly showStaffReopenChoice = computed(() => {
    if (this.isStaffLedgerOffDutyPurchase()) return false;
    const role = this.selectedStaffLedgerRole();
    if (role == null || !isEntertainmentStaffRole(role)) return false;
    return this.staffReopenStoppedRowOnSession() != null;
  });

  readonly showStaffApplyStartToggle = computed(() => {
    if (this.isStaffLedgerOffDutyPurchase()) return false;
    const role = this.selectedStaffLedgerRole();
    if (role == null || !isEntertainmentStaffRole(role)) return false;
    if ((role.startDrinks ?? 0) < 1) return false;
    if (this.showStaffReopenChoice()) {
      return this.staffReopenMode() === 'NEW_START';
    }
    return true;
  });

  readonly staffStartDrinksHint = computed(() => {
    const role = this.selectedStaffLedgerRole();
    const n = role?.startDrinks ?? 0;
    if (n < 1) return '';
    return `คนนี้มีสตาร์ท ${n} ดื่ม`;
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

  readonly roomChargeSeatingTypeOptions = computed<DropdownOption[]>(() => {
    const typeIds = this.seatingTypeIdsWithRoomCharge();
    return this.seatingTypeZones()
      .filter((z) => typeIds.has(z.id))
      .map((z) => ({ value: z.id, label: z.name }));
  });

  readonly roomChargeSeatOptions = computed<DropdownOption[]>(() => {
    const typeId = this.roomChargeSeatingTypeId();
    if (typeId == null) return [];
    return this.seats()
      .filter((s) => s.seatingTypeId === typeId && s.chargesRoomFee)
      .map((s) => ({ value: s.seatId, label: s.code }));
  });

  setAddModalMode(mode: AddModalMode): void {
    this.addModalMode.set(mode);
    if (mode === 'STAFF_LEDGER') {
      this.reloadStaffEmployees();
      this.stampStaffSeatStartTime();
    }
    if (mode === 'ROOM_CHARGE') {
      this.resetRoomChargeForm();
    }
  }

  isPcAddNavActive(key: PcAddNavKey): boolean {
    if (key === 'STAFF_LEDGER' || key === 'ROOM_CHARGE') {
      return this.addModalMode() === key;
    }
    return this.addModalMode() === 'ORDER_LEDGER' && this.orderLedgerCategory() === key;
  }

  selectPcAddNav(key: PcAddNavKey): void {
    if (key === 'STAFF_LEDGER' || key === 'ROOM_CHARGE') {
      this.setAddModalMode(key);
      this.addItemValidated.set(false);
      return;
    }
    this.setAddModalMode('ORDER_LEDGER');
    this.onOrderLedgerCategoryChange(key);
    this.addItemValidated.set(false);
  }

  ngOnInit(): void {
    const sessionParam = this.route.snapshot.queryParamMap.get('sessionId');
    const sessionId = sessionParam != null ? Number(sessionParam) : Number.NaN;
    if (Number.isFinite(sessionId) && sessionId > 0) {
      this.pendingSessionFocus = sessionId;
    }
    this.refreshFloorPlan();
    if (!this.openTableSelfBillOnly()) {
      this.loadMasterData();
    }
    this.startFloorPlanSync();
    this.bindMobileDrawerViewportListener();
  }

  private bindMobileDrawerViewportListener(): void {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(APP_MOBILE_MEDIA_QUERY);
    const onChange = (): void => this.mobileDrawerViewport.set(mq.matches);
    mq.addEventListener('change', onChange);
    this.destroyRef.onDestroy(() => mq.removeEventListener('change', onChange));
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

  /**
   * PR/entertainer (ลงดื่ม): one table at a time until stop — hide if seated elsewhere.
   * ซื้อดื่มหยุด: no seat-time row — show everyone matching role (attendance not checked).
   */
  private isStaffLedgerEmployeeSelectable(
    employee: MstEmployee,
    role: MstRole | undefined,
  ): boolean {
    if (this.staffLedgerEntryMode() === 'OFF_DUTY_PURCHASE') {
      return true;
    }
    if (!role || !isEntertainmentStaffRole(role)) {
      return true;
    }
    const staffDrinks = this.sessionDetail()?.staffDrinks ?? [];
    const activeOnThisSession = staffDrinks.some(
      (row) =>
        row.employeeRecordId === employee.id &&
        row.seatStartedLabel &&
        !row.seatStoppedLabel,
    );
    if (activeOnThisSession) {
      return false;
    }
    const stoppedOnThisSession = staffDrinks.some(
      (row) => row.employeeRecordId === employee.id && row.seatStoppedLabel,
    );
    if (stoppedOnThisSession) {
      return true;
    }
    return employee.tableSeatStatus !== 'ON_TABLE';
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
        permissionGroup: role.permissionGroup ?? 'EMPLOYEE',
        category: role.category,
        startDrinks: role.startDrinks ?? 0,
        nextHourDrinks: role.nextHourDrinks ?? 0,
        defaultPricePerDrink: role.defaultPricePerDrink ?? 0,
        drinkShopPortionBaht: role.drinkShopPortionBaht ?? 60,
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
    this.reloadStaffEmployees();
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

  private tryFocusPendingSession(): void {
    const sessionId = this.pendingSessionFocus;
    if (sessionId == null) return;
    const seat = this.seats().find((row) => row.sessionId === sessionId);
    if (!seat) return;
    this.pendingSessionFocus = null;
    this.selectSeat(seat);
  }

  private refreshFloorPlan(
    selectKey?: string | null,
    opts?: { silent?: boolean; skeleton?: boolean; onDone?: () => void },
  ): void {
    if (opts?.skeleton) {
      this.floorPlanRefreshing.set(true);
    } else if (!opts?.silent) {
      this.loading.set(true);
    }
    this.openTableService
      .getFloorPlan()
      .pipe(
        catchError(() => {
          this.toast.showError('ไม่สามารถโหลดแผนผังโต๊ะได้');
          return of({ seatingTypes: [], seatings: [], kpi: undefined, floorCanvas: undefined });
        }),
        finalize(() => {
          this.loading.set(false);
          this.floorPlanRefreshing.set(false);
          opts?.onDone?.();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((plan) => {
        if (plan.kpi) {
          this.floorPlanKpi.set(plan.kpi);
        }
        if (plan.floorCanvas) {
          this.floorCanvas.set(plan.floorCanvas);
        }
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
            chargesRoomFee: s.chargesRoomFee,
            zoneLabel: type.name,
            status: s.status,
            sessionId: s.sessionId,
            sessionRevision: s.sessionRevision ?? null,
            saleName: s.saleName ?? undefined,
            reservedSaleId: s.reservedSaleId ?? null,
            reservedCreditSaleToShop: s.reservedCreditSaleToShop ?? false,
            reservedOperatorName: s.reservedOperatorName ?? null,
            guestCount: s.guestCount ?? null,
            creditSaleToShop: s.creditSaleToShop ?? false,
            operatorSaleName: s.operatorSaleName ?? null,
            previewTotalAmount: s.previewTotalAmount ?? null,
            openDurationLabel: s.openDurationLabel ?? null,
            reservedTimeLabel: s.reservedTimeLabel ?? null,
            floorLayout: s.floorLayout ?? null,
          })),
        );
        this.seats.set(tiles);
        this.syncLayoutZoneSelection(tiles);
        if (this.floorDisplayMode() === 'layout' && !tiles.some((s) => s.floorLayout)) {
          this.floorDisplayMode.set('grid');
        }
        this.tryFocusPendingSession();
        const key = selectKey ?? this.selectedSeatKey();
        if (key && this.selectedSeatKey() === key) {
          const seat = tiles.find((s) => s.key === key);
          if (seat?.sessionId) {
            this.loadSessionDetail(seat.sessionId, { showLoading: false });
          } else {
            this.sessionDetail.set(null);
            this.sessionDetailLoading.set(false);
            if (seat?.status === 'RESERVED') {
              this.checkInCreditSaleToShop.set(seat.reservedCreditSaleToShop ?? false);
            }
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
      beverageCategories: this.shopMaster
        .getBeverageCategories()
        .pipe(catchError(() => of([] as MstBeverageCategory[]))),
      beverages: this.beverageService.getBeverages().pipe(catchError(() => of([] as MstBeverage[]))),
      cocktails: this.shopMaster.getCocktails().pipe(catchError(() => of([]))),
      promotions: this.shopMaster.getPromotions().pipe(catchError(() => of([] as MstPromotion[]))),
      memberships: this.shopMaster.getMemberships().pipe(catchError(() => of([] as MstMembership[]))),
      packageDeposits: this.packageDepositService.list().pipe(catchError(() => of([] as PackageDepositRecord[]))),
      otherCharges: this.otherChargeService.getAll().pipe(catchError(() => of([] as MstOtherCharge[]))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(
        ({ categories, foods, beverageCategories, beverages, cocktails, promotions, memberships, packageDeposits, otherCharges }) => {
        this.foodCategoriesRaw.set(categories);
        this.foodsRaw.set(foods);
        this.beverageCategoriesRaw.set(beverageCategories);
        this.beveragesRaw.set(beverages);
        this.cocktailsRaw.set(
          cocktails.map((c) => ({ id: c.id, name: c.name, drinkValue: c.drinkValue })),
        );
        this.promotionsRaw.set(promotions);
        this.membershipsRaw.set(memberships);
        this.packageDepositsRaw.set(packageDeposits);
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
          if (requestSeq === this.sessionDetailRequestSeq) {
            this.toast.showError('ไม่สามารถโหลดรายละเอียดบิลได้');
          }
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
        const normalized = detail ? this.withSessionBillTotals(detail) : null;
        this.sessionDetail.set(normalized);
        if (normalized) {
          this.syncSeatRevisionFromDetail(normalized);
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
      tiles.map((s) =>
        s.key === key
          ? {
              ...s,
              sessionRevision: detail.revision,
              guestCount: detail.guestCount ?? s.guestCount ?? null,
              creditSaleToShop: detail.creditSaleToShop ?? s.creditSaleToShop ?? false,
              saleName: detail.saleName ?? s.saleName,
              operatorSaleName: detail.operatorSaleName ?? s.operatorSaleName ?? null,
              previewTotalAmount: detail.totalAmount,
            }
          : s,
      ),
    );
  }

  /** Clear bill panel and show skeleton (e.g. while saving a new ledger line). */
  private beginSessionBillRefresh(): void {
    this.sessionDetailRequestSeq += 1;
    this.sessionDetailLoading.set(true);
    this.sessionDetail.set(null);
  }

  /** Paint skeleton briefly after modal close so bill lines (e.g. stopped room) read clearly. */
  private static readonly MIN_BILL_SKELETON_MS = 320;

  private applySessionDetailAfterBillRefresh(
    detail: OpenTableSessionDetail,
    sessionId: number,
  ): void {
    const apply = (): void => {
      if (this.selectedSeat()?.sessionId !== sessionId) {
        this.sessionDetailLoading.set(false);
        return;
      }
      const normalized = this.withSessionBillTotals(detail);
      this.sessionDetail.set(normalized);
      this.syncSeatRevisionFromDetail(normalized);
      this.sessionDetailLoading.set(false);
    };
    requestAnimationFrame(() => {
      setTimeout(apply, OpenTablePageComponent.MIN_BILL_SKELETON_MS);
    });
  }

  private cancelSessionBillRefresh(sessionId: number): void {
    this.sessionDetailLoading.set(false);
    this.loadSessionDetail(sessionId, { showLoading: false });
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
    this.selectedBeverageCategoryId.set(null);
    this.selectedBeverageId.set(null);
    this.beverageIsFreeMixer.set(false);
    this.selectedCocktailId.set(null);
    this.selectedPromotionId.set(null);
    this.selectedMembershipId.set(null);
    this.selectedOtherChargeId.set(null);
    this.orderCocktailStaffRoleId.set(null);
    this.orderCocktailStaffEmployeeId.set(null);
    this.packageOpenMode.set('NEW');
    this.packageCustomerCode.set('');
    this.packageCustomerName.set('');
    this.selectedPackageDepositId.set(null);

    if (category === 'FOOD') {
      const firstCat = this.foodCategoriesRaw()[0];
      this.selectedFoodCategoryId.set(firstCat?.id ?? null);
      this.syncFoodItemSelection();
    } else if (category === 'BEVERAGE') {
      const firstCat = this.beverageCategoriesRaw()[0];
      this.selectedBeverageCategoryId.set(firstCat?.id ?? null);
      this.syncBeverageItemSelection();
    } else if (category === 'COCKTAIL') {
      this.selectedCocktailId.set(this.cocktailsRaw()[0]?.id ?? null);
      this.syncCocktailHostSelection();
    } else if (category === 'PROMOTION') {
      this.selectedPromotionId.set(this.promotionsRaw()[0]?.id ?? null);
      this.syncPackageDepositSelection();
    } else if (category === 'MEMBER') {
      this.selectedMembershipId.set(this.membershipsRaw()[0]?.id ?? null);
      this.syncPackageDepositSelection();
    } else if (category === 'OTHER') {
      this.selectedOtherChargeId.set(this.activeMiscOtherCharges()[0]?.id ?? null);
    } else if (category === 'TABLE_OPENING') {
      this.selectedOtherChargeId.set(this.activeTableOpeningCharges()[0]?.id ?? null);
    }
  }

  private syncFoodItemSelection(): void {
    const pool = this.foodsInSelectedCategory();
    const current = this.selectedFoodId();
    if (current != null && pool.some((f) => f.id === current)) return;
    this.selectedFoodId.set(pool[0]?.id ?? null);
  }

  private syncBeverageItemSelection(): void {
    const pool = this.beveragesInSelectedCategory();
    const current = this.selectedBeverageId();
    if (current != null && pool.some((b) => b.id === current)) return;
    this.selectedBeverageId.set(pool[0]?.id ?? null);
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
    this.staffLedgerEntryMode.set('REGULAR');
    this.syncStaffLedgerRoles();
    this.staffLedgerQtyText.set('1');
    this.staffApplyStartDrinks.set(true);
    this.staffReopenMode.set('CONTINUE');
    this.staffBillAsTag.set(true);
    this.staffUsePackageFreeDrinks.set(false);
    this.stampStaffSeatStartTime();
  }

  private stampStaffSeatStartTime(): void {
    this.staffSeatStartedAt.set(currentDatetimeLocalValue());
  }

  private resetRoomChargeForm(): void {
    const typeIds = this.seatingTypeIdsWithRoomCharge();
    const firstType =
      this.seatingTypeZones().find((z) => typeIds.has(z.id))?.id ?? null;
    this.roomChargeSeatingTypeId.set(firstType);
    this.roomChargeRateType.set('NONE');
    this.roomChargeUnitPriceText.set('');
    this.roomSeatStartedAt.set(currentDatetimeLocalValue());
    this.syncRoomChargeSeating();
  }

  private syncRoomChargeSeating(): void {
    const typeId = this.roomChargeSeatingTypeId();
    const pool = this.seats().filter((s) => s.seatingTypeId === typeId && s.chargesRoomFee);
    const current = this.roomChargeSeatingId();
    if (current != null && pool.some((s) => s.seatId === current)) return;
    this.roomChargeSeatingId.set(pool[0]?.seatId ?? null);
  }

  onRoomChargeSeatingTypeChange(value: number | string | null): void {
    const typeId = value === '' || value == null ? null : Number(value);
    if (typeId == null || Number.isNaN(typeId)) {
      this.roomChargeSeatingTypeId.set(null);
      this.roomChargeSeatingId.set(null);
      return;
    }
    this.roomChargeSeatingTypeId.set(typeId);
    this.syncRoomChargeSeating();
  }

  onRoomChargeSeatingChange(value: number | string | null): void {
    const seatId = value === '' || value == null ? null : Number(value);
    this.roomChargeSeatingId.set(seatId != null && !Number.isNaN(seatId) ? seatId : null);
  }

  onRoomChargeRateTypeChange(value: number | string | null): void {
    const rate = String(value ?? '') as RoomChargeRateMode;
    if (rate !== 'NONE' && rate !== 'HOURLY' && rate !== 'FLAT_RATE') return;
    this.roomChargeRateType.set(rate);
    if (rate === 'NONE') {
      this.roomChargeUnitPriceText.set('');
    }
  }

  onRoomChargeUnitPriceInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.roomChargeUnitPriceText.set(sanitizeDigitsOnly(input.value));
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

  onBeverageCategoryChange(value: number | string | null): void {
    const id = value == null || value === '' ? null : Number(value);
    if (id == null || !Number.isFinite(id)) return;
    if (!this.beverageCategoriesRaw().some((c) => c.id === id)) return;
    this.selectedBeverageCategoryId.set(id);
    this.selectedBeverageId.set(null);
    this.beverageIsFreeMixer.set(false);
    this.syncBeverageItemSelection();
  }

  onBeverageChange(value: number | string | null): void {
    const id = value == null || value === '' ? null : Number(value);
    if (id == null || !this.beveragesInSelectedCategory().some((b) => b.id === id)) {
      this.selectedBeverageId.set(null);
      this.beverageIsFreeMixer.set(false);
      return;
    }
    this.selectedBeverageId.set(id);
    this.beverageIsFreeMixer.set(false);
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

  onPackageOpenModeChange(mode: PackageOpenMode): void {
    this.packageOpenMode.set(mode);
    this.syncPackageDepositSelection();
  }

  onPackageDepositChange(value: number | string | null): void {
    const id = value == null || value === '' ? null : Number(value);
    this.selectedPackageDepositId.set(
      id != null && this.packageDepositsRaw().some((row) => row.id === id) ? id : null,
    );
  }

  onPackageCustomerNameChange(value: string): void {
    this.packageCustomerName.set(value);
  }

  onPackageCustomerCodeChange(value: string): void {
    this.packageCustomerCode.set(trimLocalCodeInput(value));
  }

  private packageDepositOptionLabel(row: PackageDepositRecord): string {
    const code = row.customerCode?.trim();
    const name = row.customerName?.trim();
    const nickname = name && name !== code ? name : null;
    if (nickname && code) return `${nickname} (${code})`;
    if (nickname) return nickname;
    return code || name || '—';
  }

  private normalizePackageCustomerCode(value: string): string | null {
    return normalizeLocalCodeForSubmit(value);
  }

  readonly packageCustomerCodeHint = LOCAL_CODE_VALIDATORS_HINT;

  /** @returns true when deposit is already on an open table (blocks save). */
  private rejectPackageDepositIfOnOpenTable(deposit: PackageDepositRecord): boolean {
    const onSessionId = deposit.onOpenSessionId;
    if (onSessionId == null) return false;
    this.flagAddItemValidation();
    const currentSessionId = this.selectedSeat()?.sessionId;
    this.toast.showError(
      onSessionId === currentSessionId
        ? 'รายการฝากนี้ลงโต๊ะแล้ว'
        : 'รายการฝากนี้อยู่ที่โต๊ะอื่นแล้ว',
    );
    return true;
  }

  private syncPackageDepositSelection(): void {
    if (this.packageOpenMode() !== 'DEPOSIT') {
      this.selectedPackageDepositId.set(null);
      return;
    }
    const options = this.packageDepositDropdownOptions();
    const first = options[0]?.value;
    const current = this.selectedPackageDepositId();
    if (current != null && options.some((o) => o.value === current)) return;
    this.selectedPackageDepositId.set(typeof first === 'number' ? first : null);
  }

  private reloadPackageDeposits(): void {
    this.packageDepositService
      .list()
      .pipe(catchError(() => of([] as PackageDepositRecord[])), takeUntilDestroyed(this.destroyRef))
      .subscribe((rows) => this.packageDepositsRaw.set(rows));
  }

  onOtherChargeChange(value: number | string | null): void {
    const id = value == null || value === '' ? null : Number(value);
    this.selectedOtherChargeId.set(
      id != null && this.otherChargesForSelectedCategory().some((c) => c.id === id) ? id : null,
    );
  }

  onOrderQtyTextChange(value: string): void {
    this.orderQtyText.set(sanitizeDigitsOnly(value));
  }

  onStaffLedgerEntryModeChange(value: number | string | null): void {
    const mode = String(value ?? 'REGULAR') as StaffLedgerEntryMode;
    if (mode !== 'REGULAR' && mode !== 'OFF_DUTY_PURCHASE') return;
    this.staffLedgerEntryMode.set(mode);
    if (mode === 'OFF_DUTY_PURCHASE') {
      this.staffUsePackageFreeDrinks.set(false);
    }
    this.staffLedgerEmployeeId.set(null);
    this.syncStaffLedgerEmployee();
  }

  onStaffLedgerRoleChange(value: number | string | null): void {
    const roleId = value == null || value === '' ? null : Number(value);
    if (roleId == null || !this.staffLedgerRoles().some((r) => r.id === roleId)) return;
    this.staffLedgerRoleId.set(roleId);
    this.staffLedgerEmployeeId.set(null);
    this.syncStaffLedgerEmployee();
    if (isEntertainmentStaffRole(this.staffLedgerRoles().find((r) => r.id === roleId)!)) {
      this.stampStaffSeatStartTime();
      this.staffApplyStartDrinks.set(true);
      this.staffReopenMode.set('CONTINUE');
      this.staffBillAsTag.set(true);
    }
  }

  setStaffReopenMode(mode: 'CONTINUE' | 'NEW_START'): void {
    this.staffReopenMode.set(mode);
    if (mode === 'NEW_START') {
      this.staffApplyStartDrinks.set(true);
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
    this.staffReopenMode.set('CONTINUE');
    this.staffApplyStartDrinks.set(true);
    const emp = this.staffLedgerEmployees().find((e) => e.id === id);
    this.staffBillAsTag.set(emp?.hasActivePrTag === true);
    this.staffUsePackageFreeDrinks.set(false);
  }

  onStaffLedgerQtyTextChange(value: string): void {
    this.staffLedgerQtyText.set(sanitizeDigitsOnly(value));
  }

  private buildOrderLedgerPayload(): {
    items: AddItemsPayload['items'];
    staffDrinks: AddItemsPayload['staffDrinks'];
  } | null {
    const category = this.orderLedgerCategory();
    const isPackageDepositOpen =
      (category === 'PROMOTION' || category === 'MEMBER') &&
      this.packageOpenMode() === 'DEPOSIT';
    const quantity = isPackageDepositOpen
      ? 1
      : parsePositiveIntFromText(this.orderQtyText());
    const items: AddItemsPayload['items'] = [];
    const staffDrinks: AddItemsPayload['staffDrinks'] = [];

    if (category === 'FOOD') {
      const foodId = this.selectedFoodId();
      if (foodId == null) {
        this.flagAddItemValidation();
        this.toast.showError('กรุณาเลือกรายการอาหาร');
        return null;
      }
      items.push({ itemId: foodId, quantity, type: 'FOOD' });
    } else if (category === 'BEVERAGE') {
      const beverageId = this.selectedBeverageId();
      if (beverageId == null) {
        this.flagAddItemValidation();
        this.toast.showError('กรุณาเลือกเครื่องดื่ม');
        return null;
      }
      items.push({
        itemId: beverageId,
        quantity,
        type: 'DRINK',
        ...(this.selectedBeverageIsMixer()
          ? { isFreeMixer: this.beverageIsFreeMixer() }
          : {}),
      });
    } else if (category === 'COCKTAIL') {
      const cocktailId = this.selectedCocktailId();
      if (cocktailId == null) {
        this.flagAddItemValidation();
        this.toast.showError('กรุณาเลือกค็อกเทล');
        return null;
      }
      const hostId = this.orderCocktailStaffEmployeeId();
      if (hostId == null) {
        this.flagAddItemValidation();
        this.toast.showError('กรุณาเลือกพนักงานพ่วงดื่มสำหรับค็อกเทล');
        return null;
      }
      items.push({ itemId: cocktailId, quantity, type: 'COCKTAIL', hostEmployeeId: hostId });
    } else if (category === 'PROMOTION') {
      const mode = this.packageOpenMode();
      if (mode === 'DEPOSIT') {
        const depositId = this.selectedPackageDepositId();
        if (depositId == null) {
          this.flagAddItemValidation();
          this.toast.showError('กรุณาเลือกรายการฝาก');
          return null;
        }
        const deposit = this.packageDepositsRaw().find((row) => row.id === depositId);
        if (!deposit || deposit.sourceType !== 'PROMOTION') {
          this.toast.showError('ไม่พบรายการฝาก');
          return null;
        }
        if (this.rejectPackageDepositIfOnOpenTable(deposit)) {
          return null;
        }
        items.push({
          itemId: deposit.sourceId,
          quantity,
          type: 'PROMOTION',
          packageDepositMode: 'DEPOSIT',
          packageDepositId: depositId,
        });
      } else {
        const promoId = this.selectedPromotionId();
        if (promoId == null) {
          this.flagAddItemValidation();
          this.toast.showError('กรุณาเลือกโปร');
          return null;
        }
        const promo = this.promotionsRaw().find((p) => p.id === promoId);
        if (!promo) {
          this.toast.showError('ไม่พบโปร');
          return null;
        }
        if (promo.allowDeposit) {
          const customerCode = this.normalizePackageCustomerCode(this.packageCustomerCode());
          if (!customerCode) {
            this.flagAddItemValidation();
            this.toast.showError('กรุณาระบุรหัสลูกค้า 1–10 ตัวอักษร (ตัวอักษร/ตัวเลข)');
            return null;
          }
          const customerName = this.packageCustomerName().trim();
          items.push({
            itemId: promoId,
            quantity,
            type: 'PROMOTION',
            packageDepositMode: 'NEW',
            customerCode,
            ...(customerName ? { customerName } : {}),
          });
        } else {
          items.push({
            itemId: promoId,
            quantity,
            type: 'PROMOTION',
            packageDepositMode: 'NEW',
          });
        }
      }
    } else if (category === 'MEMBER') {
      const mode = this.packageOpenMode();
      if (mode === 'DEPOSIT') {
        const depositId = this.selectedPackageDepositId();
        if (depositId == null) {
          this.flagAddItemValidation();
          this.toast.showError('กรุณาเลือกรายการฝาก');
          return null;
        }
        const deposit = this.packageDepositsRaw().find((row) => row.id === depositId);
        if (!deposit || deposit.sourceType !== 'MEMBERSHIP') {
          this.toast.showError('ไม่พบรายการฝาก');
          return null;
        }
        if (this.rejectPackageDepositIfOnOpenTable(deposit)) {
          return null;
        }
        items.push({
          itemId: deposit.sourceId,
          quantity,
          type: 'MEMBERSHIP',
          packageDepositMode: 'DEPOSIT',
          packageDepositId: depositId,
        });
      } else {
        const memberId = this.selectedMembershipId();
        if (memberId == null) {
          this.flagAddItemValidation();
          this.toast.showError('กรุณาเลือกเมมเบอร์');
          return null;
        }
        const membership = this.membershipsRaw().find((m) => m.id === memberId);
        if (!membership) {
          this.toast.showError('ไม่พบเมมเบอร์');
          return null;
        }
        if (membership.allowDeposit) {
          const customerCode = this.normalizePackageCustomerCode(this.packageCustomerCode());
          if (!customerCode) {
            this.flagAddItemValidation();
            this.toast.showError('กรุณาระบุรหัสลูกค้า 1–10 ตัวอักษร (ตัวอักษร/ตัวเลข)');
            return null;
          }
          const customerName = this.packageCustomerName().trim();
          items.push({
            itemId: memberId,
            quantity,
            type: 'MEMBERSHIP',
            packageDepositMode: 'NEW',
            customerCode,
            ...(customerName ? { customerName } : {}),
          });
        } else {
          items.push({
            itemId: memberId,
            quantity,
            type: 'MEMBERSHIP',
            packageDepositMode: 'NEW',
          });
        }
      }
    } else if (category === 'OTHER' || category === 'TABLE_OPENING') {
      const otherId = this.selectedOtherChargeId();
      const pool = this.otherChargesForSelectedCategory();
      if (otherId == null || !pool.some((c) => c.id === otherId)) {
        this.flagAddItemValidation();
        this.toast.showError(
          category === 'TABLE_OPENING'
            ? 'กรุณาเลือกค่าเปิดโต๊ะ'
            : 'กรุณาเลือกรายการเบ็ดเตล็ด',
        );
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
      this.flagAddItemValidation();
      this.toast.showError('กรุณาเลือกพนักงาน');
      return null;
    }
    if (!this.staffLedgerEmployees().some((e) => e.id === employeeId)) {
      this.toast.showError('พนักงานไม่ตรงกับตำแหน่งที่เลือก');
      return null;
    }

    const role = this.selectedStaffLedgerRole();
    if (!role) {
      this.flagAddItemValidation();
      this.toast.showError('กรุณาเลือกตำแหน่งพนักงาน');
      return null;
    }

    if (this.staffLedgerEntryMode() === 'OFF_DUTY_PURCHASE') {
      const quantity = parsePositiveIntFromText(this.staffLedgerQtyText());
      if (quantity == null || quantity < 1) {
        this.flagAddItemValidation();
        this.toast.showError('กรุณาระบุจำนวนดื่ม');
        return null;
      }
      const emp = this.selectedStaffLedgerEmployee();
      const billAsTag =
        emp?.hasActivePrTag === true ? this.staffBillAsTag() : undefined;
      return [{ employeeId, quantity, billAsTag, usePackageFreeDrinks: false }];
    }

    if (isEntertainmentStaffRole(role)) {
      const seatLocal = this.staffSeatStartedAt().trim();
      if (!isValidShopDatetimeLocal(seatLocal)) {
        this.flagAddItemValidation();
        this.toast.showError('กรุณาระบุเวลาเริ่มนั่งโต๊ะ');
        return null;
      }
      const startDrinks = role.startDrinks ?? 0;
      const isReopen = this.staffReopenStoppedRowOnSession() != null;
      let applyStartDrinks = false;
      if (startDrinks > 0) {
        if (isReopen) {
          applyStartDrinks =
            this.staffReopenMode() === 'NEW_START' && this.staffApplyStartDrinks();
        } else {
          applyStartDrinks = this.staffApplyStartDrinks();
        }
      }
      const billAsTag = this.showStaffBillAsTagToggle() ? this.staffBillAsTag() : undefined;
      const usePackageFreeDrinks = this.staffUsePackageFreeDrinks();
      return [
        {
          employeeId,
          quantity: 0,
          seatStartedAt: seatLocal,
          applyStartDrinks,
          billAsTag,
          usePackageFreeDrinks,
        },
      ];
    }

    const quantity = parsePositiveIntFromText(this.staffLedgerQtyText());
    const emp = this.selectedStaffLedgerEmployee();
    const billAsTag =
      emp?.hasActivePrTag === true ? this.staffBillAsTag() : undefined;
    const usePackageFreeDrinks = this.staffUsePackageFreeDrinks();
    return [{ employeeId, quantity, billAsTag, usePackageFreeDrinks }];
  }

  setStatusFilter(value: SeatStatusFilter): void {
    this.statusFilter.set(value);
  }

  setFloorDisplayMode(mode: FloorDisplayMode): void {
    if (mode === 'layout' && !this.hasFloorLayout()) {
      this.toast.showError('ยังไม่มีผังโต๊ะ — ไปตั้งที่เมนู จัดผังโต๊ะ');
      return;
    }
    this.floorDisplayMode.set(mode);
    if (mode === 'layout') {
      this.syncLayoutZoneSelection(this.seats());
    }
    try {
      localStorage.setItem(FLOOR_DISPLAY_MODE_KEY, mode);
    } catch {
      /* ignore quota / private mode */
    }
  }

  setLayoutZone(typeId: number): void {
    this.layoutZoneId.set(typeId);
  }

  private syncLayoutZoneSelection(tiles: SeatTile[]): void {
    const zones = new Map<number, string>();
    for (const seat of tiles) {
      if (seat.floorLayout) zones.set(seat.seatingTypeId, seat.zoneLabel);
    }
    if (zones.size === 0) {
      this.layoutZoneId.set(null);
      return;
    }
    const current = this.layoutZoneId();
    if (current != null && zones.has(current)) return;
    const first = [...zones.keys()].sort((a, b) =>
      (zones.get(a) ?? '').localeCompare(zones.get(b) ?? '', 'th', {
        numeric: true,
        sensitivity: 'base',
      }),
    )[0];
    this.layoutZoneId.set(first ?? null);
  }

  layoutSeatStyle(seat: SeatTile): Record<string, string> {
    const layout = seat.floorLayout;
    if (!layout) return {};
    const canvas = this.floorCanvas();
    return floorLayoutSeatBoxStyle(
      layout.posX,
      layout.posY,
      layout.shape,
      layout.size,
      canvas.width,
      canvas.height,
    );
  }

  selectSeat(seat: SeatTile): void {
    if (this.anyModalOpen()) return;
    if (this.openTableSelfBillOnly() && !seat.sessionId && seat.status !== 'RESERVED') {
      return;
    }
    this.selectedSeatKey.set(seat.key);
    this.checkInValidated.set(false);
    this.showMobileSheet.set(true);
    if (seat.sessionId) {
      this.loadSessionDetail(seat.sessionId, { showLoading: true });
      if (!this.mobileDrawerViewport() && seat.status === 'OCCUPIED') {
        this.preparePcAddPanel();
      }
    } else {
      this.sessionDetail.set(null);
      this.sessionDetailLoading.set(false);
      const defaultSale =
        seat.reservedSaleId ??
        this.saleEmployees()[0]?.id ??
        null;
      this.checkInSalesId.set(defaultSale);
      this.checkInCreditSaleToShop.set(seat.reservedCreditSaleToShop ?? false);
      this.checkInGuestCountText.set(
        seat.guestCount != null && seat.guestCount > 0 ? String(seat.guestCount) : '1',
      );
      this.checkInMode.set('OPEN');
    }
  }

  /** Desktop: prepare left-panel add form (always visible for open bills). */
  private preparePcAddPanel(): void {
    this.syncStaffLedgerRoles();
    this.resetOrderLedgerForm();
    this.resetStaffLedgerForm();
    this.resetRoomChargeForm();
    this.addItemValidated.set(false);
    this.reloadStaffEmployees();
    this.reloadPackageDeposits();
    this.showAddModal.set(false);
    const firstNav = this.pcAddNavItems()[0]?.key ?? 'STAFF_LEDGER';
    this.selectPcAddNav(firstNav);
  }

  onCheckInGuestCountInput(value: string): void {
    this.checkInGuestCountText.set(sanitizeDigitsOnly(value));
  }

  onCheckInGuestCountKeydown(event: KeyboardEvent): void {
    blockNonNumericInputKey(event);
  }

  private parseCheckInGuestCount(): number | null {
    return parsePositiveIntFromText(this.checkInGuestCountText());
  }

  closeDrawer(): void {
    this.selectedSeatKey.set(null);
    this.sessionDetail.set(null);
    this.sessionDetailLoading.set(false);
    this.sessionDetailRequestSeq += 1;
    this.showMobileSheet.set(false);
    this.showAddModal.set(false);
    closeOpenShopFlatpickrCalendars();
    this.forcePurgeBodyModals();
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

  statusText(status: SeatStatus): string {
    if (status === 'AVAILABLE') return 'ว่าง';
    if (status === 'RESERVED') return 'จอง';
    if (status === 'AWAITING_CLEAR') return 'รอลูกค้ากลับ';
    return 'กำลังใช้งาน';
  }

  seatTileClasses(seat: SeatTile): Record<string, boolean> {
    return {
      'open-table-seat-card': true,
      [`open-table-seat-card--${seat.status.toLowerCase().replace('_', '-')}`]: true,
      'open-table-seat-card--selected': this.selectedSeatKey() === seat.key,
    };
  }

  seatCardGuestLabel(seat: SeatTile): string {
    if (seat.guestCount != null && seat.guestCount > 0) {
      return `${seat.guestCount} คน`;
    }
    return '—';
  }

  seatCanEditSessionInfo(seat: SeatTile | null | undefined): boolean {
    return seat?.status === 'OCCUPIED' && seat.sessionId != null;
  }

  openEditGuestCountFromPanel(): void {
    const seat = this.selectedSeat();
    if (!this.seatCanEditSessionInfo(seat)) return;
    this.sessionInfoEditTarget.set(seat);
    const count =
      this.sessionDetail()?.guestCount ?? seat?.guestCount ?? null;
    this.editGuestCountText.set(count != null && count > 0 ? String(count) : '1');
    this.showEditGuestCountModal.set(true);
  }

  openEditCreditSaleFromPanel(): void {
    const seat = this.selectedSeat();
    if (!this.seatCanEditSessionInfo(seat)) return;
    this.sessionInfoEditTarget.set(seat);
    this.editCreditSaleToShop.set(
      this.sessionDetail()?.creditSaleToShop ?? seat?.creditSaleToShop ?? false,
    );
    this.showEditCreditSaleModal.set(true);
  }

  closeEditGuestCountModal(): void {
    this.showEditGuestCountModal.set(false);
    this.sessionInfoEditTarget.set(null);
  }

  closeEditCreditSaleModal(): void {
    this.showEditCreditSaleModal.set(false);
    this.sessionInfoEditTarget.set(null);
  }

  onEditGuestCountInput(value: string): void {
    this.editGuestCountText.set(sanitizeDigitsOnly(value));
  }

  onEditGuestCountKeydown(event: KeyboardEvent): void {
    blockNonNumericInputKey(event);
  }

  submitEditGuestCount(): void {
    const seat = this.sessionInfoEditTarget() ?? this.selectedSeat();
    const sessionId = seat?.sessionId;
    const expectedRevision = seat?.sessionRevision ?? this.expectedRevision();
    const guestCount = parsePositiveIntFromText(this.editGuestCountText());
    if (!sessionId || expectedRevision == null) {
      this.toast.showError('กรุณารอโหลดบิลโต๊ะสักครู่');
      return;
    }
    if (guestCount == null || guestCount < 1) {
      this.toast.showError('กรุณาระบุจำนวนลูกค้า');
      return;
    }
    this.runAction(
      this.openTableService.updateSessionInfo({
        shopId: this.shopId,
        sessionId,
        expectedRevision,
        guestCount,
      }),
      'บันทึกจำนวนลูกค้าแล้ว',
      (detail) => {
        this.closeEditGuestCountModal();
        this.applyBillDetailAfterMutation(detail, sessionId);
        this.refreshFloorPlan(this.selectedSeatKey(), { silent: true });
      },
    );
  }

  submitEditCreditSale(): void {
    const seat = this.sessionInfoEditTarget() ?? this.selectedSeat();
    const sessionId = seat?.sessionId;
    const expectedRevision = seat?.sessionRevision ?? this.expectedRevision();
    if (!sessionId || expectedRevision == null) {
      this.toast.showError('กรุณารอโหลดบิลโต๊ะสักครู่');
      return;
    }
    this.runAction(
      this.openTableService.updateSessionInfo({
        shopId: this.shopId,
        sessionId,
        expectedRevision,
        creditSaleToShop: this.editCreditSaleToShop(),
      }),
      'บันทึกยอดเข้าร้านแล้ว',
      (detail) => {
        this.closeEditCreditSaleModal();
        this.applyBillDetailAfterMutation(detail, sessionId);
        this.refreshFloorPlan(this.selectedSeatKey(), { silent: true });
      },
    );
  }

  statusDotClass(status: SeatStatus): Record<string, boolean> {
    return {
      'open-table-status-dot': true,
      'open-table-status-dot--available': status === 'AVAILABLE',
      'open-table-status-dot--reserved': status === 'RESERVED',
      'open-table-status-dot--occupied': status === 'OCCUPIED',
      'open-table-status-dot--awaiting-clear': status === 'AWAITING_CLEAR',
    };
  }

  setCheckInMode(mode: CheckInMode): void {
    this.checkInMode.set(mode);
  }

  async submitSeatAction(): Promise<void> {
    const seat = this.selectedSeat();
    if (!seat) return;
    if (seat.status === 'RESERVED' || this.checkInMode() === 'OPEN') {
      await this.checkInSelectedSeat();
      return;
    }
    await this.reserveSelectedSeat();
  }

  async reserveSelectedSeat(): Promise<void> {
    const seat = this.selectedSeat();
    const salesId = this.checkInSalesId();
    const guestCount = this.parseCheckInGuestCount();
    this.checkInValidated.set(true);
    if (!seat || seat.status !== 'AVAILABLE' || salesId == null) {
      this.toast.showError('กรุณาเลือกเซลล์');
      return;
    }
    if (guestCount == null) {
      this.toast.showError('กรุณาระบุจำนวนลูกค้า');
      return;
    }
    this.checkInValidated.set(false);

    const saleName =
      this.saleEmployees().find((e) => e.id === salesId)?.nickname ?? '—';
    const creditToShop = this.checkInCreditSaleToShop();
    const saleLine = creditToShop
      ? `ยอดเข้าร้าน (เปิดโดยเซลล์ ${saleName})`
      : `เซลล์ ${saleName}`;
    const ok = await this.confirmDialog.confirm({
      title: 'จองโต๊ะ',
      message: `จอง ${seat.zoneLabel} · ${seat.code} · ${guestCount} คน · ${saleLine} ใช่หรือไม่?`,
      confirmLabel: 'จอง',
    });
    if (!ok) return;

    this.seatPanelLoading.set(true);
    this.runAction(
      this.openTableService.reserveSeat({
        shopId: this.shopId,
        salesId,
        seatingId: seat.seatId,
        guestCount,
        creditSaleToShop: creditToShop || undefined,
      }),
      'จองโต๊ะสำเร็จ',
      () => {
        this.refreshFloorPlan(seat.key, {
          skeleton: true,
          onDone: () => this.seatPanelLoading.set(false),
        });
      },
      () => {
        this.seatPanelLoading.set(false);
        this.refreshFloorPlan(this.selectedSeatKey(), { silent: true });
      },
    );
  }

  cancelSelectedReservation(): void {
    const seat = this.selectedSeat();
    if (!seat || seat.status !== 'RESERVED') {
      this.toast.showError('โต๊ะนี้ไม่ได้อยู่ในสถานะจอง');
      return;
    }

    this.seatPanelLoading.set(true);
    this.runAction(
      this.openTableService.cancelReservation({
        shopId: this.shopId,
        seatingId: seat.seatId,
      }),
      'ยกเลิกการจองแล้ว',
      () => {
        this.refreshFloorPlan(seat.key, {
          skeleton: true,
          onDone: () => this.seatPanelLoading.set(false),
        });
      },
      () => {
        this.seatPanelLoading.set(false);
        this.refreshFloorPlan(this.selectedSeatKey(), { silent: true });
      },
    );
  }

  async checkInSelectedSeat(): Promise<void> {
    const seat = this.selectedSeat();
    const salesId = this.checkInSalesId();
    const guestCount = this.parseCheckInGuestCount();
    this.checkInValidated.set(true);
    if (!seat || salesId == null) {
      this.toast.showError('กรุณาเลือกเซลล์');
      return;
    }
    if (guestCount == null) {
      this.toast.showError('กรุณาระบุจำนวนลูกค้า');
      return;
    }
    this.checkInValidated.set(false);
    if (seat.status !== 'AVAILABLE' && seat.status !== 'RESERVED') {
      this.toast.showError('โต๊ะนี้ไม่ว่าง');
      return;
    }

    const saleName =
      this.saleEmployees().find((e) => e.id === salesId)?.nickname ?? '—';
    const creditToShop = this.checkInCreditSaleToShop();
    const saleLine = creditToShop
      ? `ยอดเข้าร้าน (เปิดโดยเซลล์ ${saleName})`
      : `เซลล์ ${saleName}`;
    const ok = await this.confirmDialog.confirm({
      title: seat.status === 'RESERVED' ? 'เปิดโต๊ะ (ลูกค้ามาแล้ว)' : 'เปิดโต๊ะ',
      message: `เปิด ${seat.zoneLabel} · ${seat.code} · ${guestCount} คน · ${saleLine} ใช่หรือไม่?`,
      confirmLabel: 'เปิดโต๊ะ',
    });
    if (!ok) return;

    this.runAction(
      this.openTableService.openTable({
        shopId: this.shopId,
        salesId,
        seatingId: seat.seatId,
        guestCount,
        creditSaleToShop: creditToShop || undefined,
      }),
      'เปิดโต๊ะสำเร็จ',
      (session) => {
        this.applySeatCheckIn(seat.key, session.id, saleName, session.revision ?? 1);
        this.refreshFloorPlan(seat.key, { skeleton: true });
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
      this.toast.showError(
        'โต๊ะนี้ถูกเช็กบิลแล้ว ไม่สามารถเพิ่มรายการได้ — ถ้าลูกค้าออกจากโต๊ะแล้วให้กดลูกค้ากลับ',
      );
      return;
    }
    this.showMobileSheet.set(false);
    this.addModalMode.set('ORDER_LEDGER');
    this.syncStaffLedgerRoles();
    this.resetOrderLedgerForm();
    this.resetStaffLedgerForm();
    this.resetRoomChargeForm();
    this.addItemValidated.set(false);
    this.reloadStaffEmployees();
    this.reloadPackageDeposits();
    if (this.mobileDrawerViewport()) {
      this.showAddModal.set(true);
    } else {
      this.preparePcAddPanel();
    }
  }

  private flagAddItemValidation(): void {
    this.addItemValidated.set(true);
  }

  closeAddModal(): void {
    closeOpenShopFlatpickrCalendars();
    this.showAddModal.set(false);
    this.forcePurgeBodyModals();
    if (this.selectedSeatKey() && this.mobileDrawerViewport()) {
      this.showMobileSheet.set(true);
    } else if (!this.mobileDrawerViewport() && this.ledgerCanMutate()) {
      this.preparePcAddPanel();
    }
  }

  /** Remove portaled modal shell immediately (avoids frozen overlay + hidden toast). */
  private forcePurgeBodyModals(): void {
    document.body.classList.remove(APP_MODAL_BODY_LOCK_CLASS);
    document.querySelectorAll('body > app-modal').forEach((el) => el.remove());
    this.schedulePortaledModalPurge();
  }

  /** Portaled `app-modal` hosts can outlive `@if` destroy — remove stale overlays. */
  private purgePortaledModalsWhenNoneOpen(): void {
    this.schedulePortaledModalPurge();
  }

  /** Sweep after Angular tears down `@if (showAddModal)` — multiple ticks for mobile flatpickr. */
  private schedulePortaledModalPurge(): void {
    const sweep = (): void => {
      if (this.anyModalOpen()) return;
      document.body.classList.remove(APP_MODAL_BODY_LOCK_CLASS);
      document.querySelectorAll('body > app-modal').forEach((el) => el.remove());
    };
    queueMicrotask(sweep);
    requestAnimationFrame(sweep);
    setTimeout(sweep, 0);
    setTimeout(sweep, 50);
  }

  private applyBillDetailAfterMutation(
    detail: OpenTableSessionDetail,
    sessionId: number,
  ): void {
    if (Number(detail.sessionId) === Number(sessionId)) {
      this.applySessionDetailAfterBillRefresh(detail, sessionId);
    } else {
      this.sessionDetailLoading.set(false);
      this.loadSessionDetail(sessionId, { showLoading: false });
    }
  }

  onMutationChangeReasonChange(value: string): void {
    this.mutationChangeReason.set(value);
    if (this.mutationReasonValidated() && value.trim().length >= CHANGE_REASON_MIN_LEN) {
      this.mutationReasonValidated.set(false);
    }
  }

  private resetMutationChangeReason(): void {
    this.mutationChangeReason.set('');
    this.mutationReasonValidated.set(false);
  }

  private requiredMutationChangeReason(): string | null {
    const reason = this.mutationChangeReason().trim();
    if (reason.length < CHANGE_REASON_MIN_LEN) {
      this.mutationReasonValidated.set(true);
      this.toast.showError('กรุณาระบุเหตุผลการแก้ไข/ลบอย่างน้อย 3 ตัวอักษร');
      return null;
    }
    this.mutationReasonValidated.set(false);
    return reason;
  }

  /**
   * บิล mutation จาก portaled modal — flow เดียวกันทุกจุด:
   * skeleton ตอนกดยืนยัน → API → toast → ปิด modal → แสดงบิลใหม่
   */
  private submitBillPanelMutation(
    request$: import('rxjs').Observable<OpenTableSessionDetail>,
    successMessage: string,
    sessionId: number,
    closeModal: () => void,
    afterApply?: () => void,
  ): void {
    if (this.actionBusy()) return;
    closeOpenShopFlatpickrCalendars();
    this.beginSessionBillRefresh();
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
      .subscribe((detail) => {
        if (detail == null) {
          this.cancelSessionBillRefresh(sessionId);
          closeModal();
          return;
        }
        this.toast.showSuccess(successMessage);
        closeModal();
        this.applyBillDetailAfterMutation(detail, sessionId);
        afterApply?.();
      });
  }

  private submitAddModalBillMutation(
    request$: import('rxjs').Observable<OpenTableSessionDetail>,
    successMessage: string,
    sessionId: number,
    afterApply?: () => void,
  ): void {
    this.submitBillPanelMutation(
      request$,
      successMessage,
      sessionId,
      () => this.closeAddModal(),
      afterApply,
    );
  }

  submitAddItems(): void {
    void this.submitAddItemsAsync();
  }

  private async submitAddItemsAsync(): Promise<void> {
    this.flushAddModalDatetimes();
    if (!this.ledgerCanMutate()) {
      this.toast.showError(
        'โต๊ะนี้ถูกเช็กบิลแล้ว ไม่สามารถเพิ่มรายการได้ — ถ้าลูกค้าออกจากโต๊ะแล้วให้กดลูกค้ากลับ',
      );
      this.closeAddModal();
      return;
    }
    const sessionId = this.selectedSeat()?.sessionId;
    const expectedRevision = this.requireExpectedRevision();
    if (!sessionId || expectedRevision == null) {
      if (!sessionId) this.toast.showError('ไม่พบเซสชัน');
      return;
    }

    if (this.addModalMode() === 'ROOM_CHARGE') {
      const seatingId = this.roomChargeSeatingId();
      const rateType = this.roomChargeRateType();
      if (seatingId == null) {
        this.flagAddItemValidation();
        this.toast.showError('กรุณาเลือกประเภทและที่นั่ง');
        return;
      }
      const seatStartedAt = this.roomSeatStartedAt().trim();
      if (!isValidShopDatetimeLocal(seatStartedAt)) {
        this.flagAddItemValidation();
        this.toast.showError('กรุณาระบุเวลาเริ่มใช้ให้ถูกต้อง');
        return;
      }
      let unitPrice = 0;
      if (rateType === 'HOURLY' || rateType === 'FLAT_RATE') {
        const parsed = parsePositiveIntFromText(this.roomChargeUnitPriceText());
        if (parsed == null) {
          this.flagAddItemValidation();
          this.toast.showError('กรุณาใส่ราคา (บาท)');
          return;
        }
        unitPrice = parsed;
      }
      const roomOk = await this.confirmDialog.confirm({
        title: 'บันทึกค่าห้อง',
        message: this.buildRoomChargeConfirmMessage(seatingId, rateType, unitPrice, seatStartedAt),
        confirmLabel: 'บันทึก',
      });
      if (!roomOk) return;

      this.submitAddModalBillMutation(
        this.openTableService.addRoomCharge({
          shopId: this.shopId,
          sessionId,
          expectedRevision,
          seatingId,
          rateType,
          unitPrice,
          seatStartedAt,
        }),
        'เพิ่มค่าห้องสำเร็จ',
        sessionId,
      );
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
        : this.staffLedgerEntryMode() === 'OFF_DUTY_PURCHASE'
          ? 'บันทึกซื้อดื่มหยุดสำเร็จ'
          : 'บันทึกรันดื่มพนักงานสำเร็จ';

    const ok = await this.confirmDialog.confirm({
      title:
        this.addModalMode() === 'ORDER_LEDGER'
          ? 'บันทึกรายการ'
          : this.staffLedgerEntryMode() === 'OFF_DUTY_PURCHASE'
            ? 'บันทึกซื้อดื่มหยุด'
            : 'บันทึกรันดื่ม',
      message:
        this.addModalMode() === 'ORDER_LEDGER'
          ? 'เพิ่มรายการลงโต๊ะนี้ ใช่หรือไม่?'
          : this.buildStaffLedgerConfirmMessage(),
      confirmLabel: 'บันทึก',
    });
    if (!ok) return;

    this.submitAddModalBillMutation(
      this.openTableService.addOrderItems({
        shopId: this.shopId,
        sessionId,
        expectedRevision,
        items,
        staffDrinks,
      }),
      successMessage,
      sessionId,
      () => {
        if (staffDrinks.length > 0) {
          this.reloadStaffEmployees();
        }
        if (
          items.some(
            (row) =>
              row.type === 'PROMOTION' ||
              row.type === 'MEMBERSHIP' ||
              row.packageDepositMode != null,
          )
        ) {
          this.reloadPackageDeposits();
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
    closeOpenShopFlatpickrCalendars();
    this.showTransferModal.set(false);
    this.schedulePortaledModalPurge();
    if (this.selectedSeatKey()) {
      this.showMobileSheet.set(true);
    }
  }

  submitTransfer(): void {
    void this.submitTransferAsync();
  }

  private async submitTransferAsync(): Promise<void> {
    const seat = this.selectedSeat();
    const destKey = this.transferDestinationKey();
    const destination = destKey ? this.seats().find((s) => s.key === destKey) : null;
    const expectedRevision = this.requireExpectedRevision();
    if (!seat?.sessionId || !destination || expectedRevision == null) {
      this.toast.showError('กรุณาเลือกปลายทาง');
      return;
    }

    const ok = await this.confirmDialog.confirm({
      title: 'ย้ายที่นั่ง',
      message: `ย้ายจาก ${seat.code} ไป ${destination.code} ใช่หรือไม่?`,
      confirmLabel: 'ย้าย',
    });
    if (!ok) return;

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
    this.resetMutationChangeReason();
    this.stopRoomTarget.set(row);
    this.stopSeatTime.set(currentDatetimeLocalValue());
    this.stopSeatTimeValidated.set(false);
    this.showStopRoomModal.set(true);
    this.showMobileSheet.set(false);
  }

  closeStopRoomModal(): void {
    closeOpenShopFlatpickrCalendars();
    this.showStopRoomModal.set(false);
    this.stopRoomTarget.set(null);
    this.resetMutationChangeReason();
    this.forcePurgeBodyModals();
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
    const seatStoppedAt = this.resolvedStopSeatTime();
    this.stopSeatTimeValidated.set(true);
    if (!isValidShopDatetimeLocal(seatStoppedAt)) {
      this.toast.showError('กรุณาระบุเวลาสต็อป');
      return;
    }
    this.stopSeatTimeValidated.set(false);
    const changeReason = this.requiredMutationChangeReason();
    if (!changeReason) return;
    this.submitBillPanelMutation(
      this.openTableService.stopRoomCharge({
        shopId: this.shopId,
        sessionId,
        expectedRevision,
        roomChargeId: row.roomChargeId,
        seatStoppedAt,
        changeReason,
      }),
      'สต็อปห้องสำเร็จ',
      sessionId,
      () => this.closeStopRoomModal(),
    );
  }

  openDeleteRoomChargeModal(row: SessionRoomCharge): void {
    this.resetMutationChangeReason();
    this.deleteRoomChargeTarget.set(row);
    this.showDeleteRoomChargeModal.set(true);
    this.showMobileSheet.set(false);
  }

  closeDeleteRoomChargeModal(): void {
    this.showDeleteRoomChargeModal.set(false);
    this.deleteRoomChargeTarget.set(null);
    this.resetMutationChangeReason();
    this.schedulePortaledModalPurge();
    if (this.selectedSeatKey()) {
      this.showMobileSheet.set(true);
    }
  }

  confirmDeleteRoomCharge(): void {
    if (!this.ledgerCanMutate()) {
      this.toast.showError('โต๊ะนี้ถูกเช็กบิลแล้ว ไม่สามารถแก้รายการได้');
      this.closeDeleteRoomChargeModal();
      return;
    }
    const sessionId = this.selectedSeat()?.sessionId;
    const expectedRevision = this.requireExpectedRevision();
    const row = this.deleteRoomChargeTarget();
    if (!sessionId || !row || expectedRevision == null) {
      this.toast.showError('ไม่พบรายการค่าห้อง');
      return;
    }
    const changeReason = this.requiredMutationChangeReason();
    if (!changeReason) return;
    this.submitBillPanelMutation(
      this.openTableService.deleteRoomCharge({
        shopId: this.shopId,
        sessionId,
        expectedRevision,
        roomChargeId: row.roomChargeId,
        changeReason,
      }),
      'ลบค่าห้องสำเร็จ',
      sessionId,
      () => this.closeDeleteRoomChargeModal(),
    );
  }

  openEditRoomChargeModal(row: SessionRoomCharge): void {
    this.resetMutationChangeReason();
    this.editRoomChargeTarget.set(row);
    this.editRoomChargeRateType.set(row.pricingType as RoomChargeRateMode);
    this.editRoomChargeUnitPriceText.set(
      row.pricingType === 'NONE' ? '' : String(Math.max(0, row.unitPrice)),
    );
    this.showEditRoomChargeModal.set(true);
    this.showMobileSheet.set(false);
  }

  closeEditRoomChargeModal(): void {
    this.showEditRoomChargeModal.set(false);
    this.editRoomChargeTarget.set(null);
    this.resetMutationChangeReason();
    this.schedulePortaledModalPurge();
    if (this.selectedSeatKey()) {
      this.showMobileSheet.set(true);
    }
  }

  onEditRoomChargeRateTypeChange(value: string | number | null): void {
    const rate = String(value ?? 'NONE') as RoomChargeRateMode;
    this.editRoomChargeRateType.set(rate);
    if (rate === 'NONE') {
      this.editRoomChargeUnitPriceText.set('');
    }
  }

  onEditRoomChargeUnitPriceChange(value: string): void {
    this.editRoomChargeUnitPriceText.set(sanitizeDigitsOnly(value));
  }

  confirmEditRoomCharge(): void {
    if (!this.ledgerCanMutate()) {
      this.toast.showError('โต๊ะนี้ถูกเช็กบิลแล้ว ไม่สามารถแก้รายการได้');
      this.closeEditRoomChargeModal();
      return;
    }
    const sessionId = this.selectedSeat()?.sessionId;
    const expectedRevision = this.requireExpectedRevision();
    const row = this.editRoomChargeTarget();
    if (!sessionId || !row || expectedRevision == null) {
      this.toast.showError('ไม่พบรายการค่าห้อง');
      return;
    }
    const rateType = this.editRoomChargeRateType();
    let unitPrice = 0;
    if (rateType === 'HOURLY' || rateType === 'FLAT_RATE') {
      const parsed = parsePositiveIntFromText(this.editRoomChargeUnitPriceText());
      if (parsed == null) {
        this.toast.showError('กรุณาใส่ราคา (บาท)');
        return;
      }
      unitPrice = parsed;
    }
    const changeReason = this.requiredMutationChangeReason();
    if (!changeReason) return;
    this.submitBillPanelMutation(
      this.openTableService.updateRoomCharge({
        shopId: this.shopId,
        sessionId,
        expectedRevision,
        roomChargeId: row.roomChargeId,
        rateType,
        unitPrice,
        changeReason,
      }),
      'แก้ไขค่าห้องสำเร็จ',
      sessionId,
      () => this.closeEditRoomChargeModal(),
    );
  }

  openStopDrinkModal(row: SessionStaffDrink): void {
    this.resetMutationChangeReason();
    this.stopDrinkTarget.set(row);
    this.stopSeatTime.set(currentDatetimeLocalValue());
    this.stopSeatTimeValidated.set(false);
    this.stopDrinkPreview.set(null);
    this.showStopDrinkModal.set(true);
    this.showMobileSheet.set(false);
    this.scheduleStopDrinkPreview();
  }

  closeStopDrinkModal(): void {
    closeOpenShopFlatpickrCalendars();
    if (this.stopDrinkPreviewTimer != null) {
      clearTimeout(this.stopDrinkPreviewTimer);
      this.stopDrinkPreviewTimer = null;
    }
    this.stopDrinkPreview.set(null);
    this.showStopDrinkModal.set(false);
    this.stopDrinkTarget.set(null);
    this.resetMutationChangeReason();
    this.forcePurgeBodyModals();
    if (this.selectedSeatKey()) {
      this.showMobileSheet.set(true);
    }
  }

  onStopSeatTimeChange(value: string): void {
    this.stopSeatTime.set(value);
    this.scheduleStopDrinkPreview();
  }

  private scheduleStopDrinkPreview(): void {
    if (this.stopDrinkPreviewTimer != null) {
      clearTimeout(this.stopDrinkPreviewTimer);
    }
    this.stopDrinkPreviewTimer = setTimeout(() => {
      this.stopDrinkPreviewTimer = null;
      this.loadStopDrinkPreview();
    }, 350);
  }

  private loadStopDrinkPreview(): void {
    const sessionId = this.selectedSeat()?.sessionId;
    const row = this.stopDrinkTarget();
    const seatStoppedAt = this.stopSeatTime().trim();
    if (!sessionId || !row || !isValidShopDatetimeLocal(seatStoppedAt)) {
      this.stopDrinkPreview.set(null);
      return;
    }
    this.stopDrinkPreviewLoading.set(true);
    this.openTableService
      .previewStopStaffDrink({
        shopId: this.shopId,
        sessionId,
        staffDrinkId: row.staffDrinkId,
        seatStoppedAt,
      })
      .pipe(
        catchError((err: { error?: { error?: string } }) => {
          this.stopDrinkPreview.set(null);
          const msg = err.error?.error;
          if (msg) this.toast.showError(msg);
          return of(null);
        }),
        finalize(() => this.stopDrinkPreviewLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((preview) => {
        if (preview && this.showStopDrinkModal()) {
          this.stopDrinkPreview.set(preview);
        }
      });
  }

  confirmStopDrink(): void {
    if (this.stopDrinkPreviewTimer != null) {
      clearTimeout(this.stopDrinkPreviewTimer);
      this.stopDrinkPreviewTimer = null;
    }
    const sessionId = this.selectedSeat()?.sessionId;
    const expectedRevision = this.requireExpectedRevision();
    const row = this.stopDrinkTarget();
    if (!sessionId || !row || expectedRevision == null) {
      this.toast.showError('ไม่พบรายการรันดื่ม');
      return;
    }
    const seatStoppedAt = this.resolvedStopSeatTime();
    this.stopSeatTimeValidated.set(true);
    if (!isValidShopDatetimeLocal(seatStoppedAt)) {
      this.toast.showError('กรุณาระบุเวลาสต็อป');
      return;
    }
    this.stopSeatTimeValidated.set(false);
    const changeReason = this.requiredMutationChangeReason();
    if (!changeReason) return;
    this.submitBillPanelMutation(
      this.openTableService.stopStaffDrink({
        shopId: this.shopId,
        sessionId,
        expectedRevision,
        staffDrinkId: row.staffDrinkId,
        seatStoppedAt,
        changeReason,
      }),
      'สต็อปดื่มสำเร็จ',
      sessionId,
      () => this.closeStopDrinkModal(),
      () => this.reloadStaffEmployees(),
    );
  }

  openReturnBeverageModal(item: SessionOrderItem): void {
    this.resetMutationChangeReason();
    this.returnBeverageTarget.set(item);
    this.returnBeverageQtyText.set('1');
    this.showReturnBeverageModal.set(true);
    this.showMobileSheet.set(false);
  }

  closeReturnBeverageModal(): void {
    this.showReturnBeverageModal.set(false);
    this.returnBeverageTarget.set(null);
    this.resetMutationChangeReason();
    this.schedulePortaledModalPurge();
    if (this.selectedSeatKey()) {
      this.showMobileSheet.set(true);
    }
  }

  onReturnBeverageQtyChange(value: string): void {
    this.returnBeverageQtyText.set(sanitizeDigitsOnly(value));
  }

  packageBottleLabel(item: SessionOrderItem): string | null {
    if (item.packageBottlesRemaining == null || item.packageBottlesTotal == null) {
      return null;
    }
    return `${item.packageBottlesRemaining}/${item.packageBottlesTotal}`;
  }

  packageBottleWithdrawMoves(item: SessionOrderItem): PackageBottleMoveLine[] {
    return (item.packageBottleMoves ?? []).filter((move) => move.action === 'WITHDRAW');
  }

  billItemKey(item: SessionOrderItem): string {
    return `${item.itemId}|${item.itemType}|${item.unitPrice}|${item.isFreeMixer}|${item.unitLabelTh ?? item.unitLabel}|${item.itemName ?? item.label}`;
  }

  private packageBottleItemByKey(key: string | null): SessionOrderItem | null {
    if (!key) return null;
    return this.packageBottleBillItems().find((item) => this.billItemKey(item) === key) ?? null;
  }

  defaultLiquorDisplayName(item: SessionOrderItem): string {
    const list =
      item.itemType === 'PROMOTION' ? this.promotionsRaw() : this.membershipsRaw();
    const row = list.find((entry) => entry.id === item.itemId);
    return drinkPackageItemsSummary(row?.items);
  }

  openPackageBottleModal(action: 'WITHDRAW' | 'DEPOSIT', item?: SessionOrderItem): void {
    if (!this.ledgerCanMutate()) {
      this.toast.showError('โต๊ะนี้ถูกเช็กบิลแล้ว ไม่สามารถแก้รายการได้');
      return;
    }
    this.packageBottleAction.set(action);
    const options = this.packageBottleBillItems().filter((row) =>
      action === 'WITHDRAW' ? row.canWithdrawPackageBottle : row.canDepositPackageBottle,
    );
    if (options.length === 0) {
      this.toast.showError(
        action === 'WITHDRAW' ? 'ไม่มีขวดเหลือให้เบิก' : 'ไม่สามารถฝากขวดเพิ่มได้',
      );
      return;
    }

    let selected = item;
    if (selected) {
      const allowed =
        action === 'WITHDRAW'
          ? selected.canWithdrawPackageBottle
          : selected.canDepositPackageBottle;
      if (!allowed) {
        this.toast.showError(
          action === 'WITHDRAW' ? 'ไม่มีขวดเหลือให้เบิก' : 'ไม่สามารถฝากขวดเพิ่มได้',
        );
        return;
      }
    } else {
      selected = options[0]!;
    }

    const key = this.billItemKey(selected);
    this.resetMutationChangeReason();
    this.packageBottleBillItemKey.set(key);
    this.packageBottleDisplayNameText.set(this.defaultLiquorDisplayName(selected));
    this.packageBottleQtyText.set('1');
    this.showPackageBottleModal.set(true);
    this.showMobileSheet.set(false);
  }

  packageBottleModalMaxQty(): number | null {
    const item = this.packageBottleItemByKey(this.packageBottleBillItemKey());
    if (!item) return null;
    if (this.packageBottleAction() === 'WITHDRAW') {
      return item.packageBottlesRemaining ?? 0;
    }
    return (item.packageBottlesTotal ?? 0) - (item.packageBottlesRemaining ?? 0);
  }

  packageBottleModalItemLabel(): string | null {
    const item = this.packageBottleItemByKey(this.packageBottleBillItemKey());
    return item?.label ?? null;
  }

  closePackageBottleModal(): void {
    this.showPackageBottleModal.set(false);
    this.packageBottleBillItemKey.set(null);
    this.packageBottleDisplayNameText.set('');
    this.packageBottleQtyText.set('1');
    this.resetMutationChangeReason();
    this.schedulePortaledModalPurge();
    if (this.selectedSeatKey()) {
      this.showMobileSheet.set(true);
    }
  }

  onPackageBottleBillItemChange(value: string | null): void {
    const key = value == null || value === '' ? null : String(value);
    this.packageBottleBillItemKey.set(key);
    const item = this.packageBottleItemByKey(key);
    if (item) {
      this.packageBottleDisplayNameText.set(this.defaultLiquorDisplayName(item));
    }
  }

  onPackageBottleQtyChange(value: string): void {
    this.packageBottleQtyText.set(sanitizeDigitsOnly(value));
  }

  onPackageBottleDisplayNameChange(value: string): void {
    this.packageBottleDisplayNameText.set(value);
  }

  confirmPackageBottle(): void {
    if (!this.ledgerCanMutate()) {
      this.toast.showError('โต๊ะนี้ถูกเช็กบิลแล้ว ไม่สามารถแก้รายการได้');
      this.closePackageBottleModal();
      return;
    }
    const sessionId = this.selectedSeat()?.sessionId;
    const expectedRevision = this.requireExpectedRevision();
    const item = this.packageBottleItemByKey(this.packageBottleBillItemKey());
    const action = this.packageBottleAction();
    if (!sessionId || !item || expectedRevision == null) {
      this.toast.showError('ไม่พบรายการ');
      return;
    }
    if (item.itemType !== 'PROMOTION' && item.itemType !== 'MEMBERSHIP') {
      return;
    }
    const displayName = this.packageBottleDisplayNameText().trim();
    if (!displayName) {
      this.toast.showError('กรุณาระบุชื่อเหล้า');
      return;
    }
    const quantity = parsePositiveIntFromText(this.packageBottleQtyText());
    if (quantity == null || quantity <= 0) {
      this.toast.showError('กรุณาระบุจำนวนขวด');
      return;
    }
    const maxQty = this.packageBottleModalMaxQty();
    if (maxQty != null && quantity > maxQty) {
      this.toast.showError(
        action === 'WITHDRAW'
          ? `เบิกได้สูงสุด ${maxQty} ขวด`
          : `ฝากเพิ่มได้สูงสุด ${maxQty} ขวด`,
      );
      return;
    }
    const changeReason = this.requiredMutationChangeReason();
    if (!changeReason) return;
    this.submitBillPanelMutation(
      this.openTableService.adjustPackageBottles({
        shopId: this.shopId,
        sessionId,
        expectedRevision,
        itemType: item.itemType,
        itemId: item.itemId,
        itemName: item.itemName ?? item.label,
        unitPrice: item.unitPrice,
        isFreeMixer: Boolean(item.isFreeMixer),
        unitLabelTh: item.unitLabelTh ?? item.unitLabel,
        action,
        quantity,
        displayName,
        changeReason,
      }),
      action === 'WITHDRAW' ? 'เบิกขวดสำเร็จ' : 'ฝากขวดสำเร็จ',
      sessionId,
      () => this.closePackageBottleModal(),
    );
  }

  openVoidItemModal(item: SessionOrderItem): void {
    this.resetMutationChangeReason();
    this.voidItemTarget.set(item);
    this.voidItemQtyText.set('1');
    this.showVoidItemModal.set(true);
    this.showMobileSheet.set(false);
  }

  closeVoidItemModal(): void {
    this.showVoidItemModal.set(false);
    this.voidItemTarget.set(null);
    this.resetMutationChangeReason();
    this.schedulePortaledModalPurge();
    if (this.selectedSeatKey()) {
      this.showMobileSheet.set(true);
    }
  }

  onVoidItemQtyChange(value: string): void {
    this.voidItemQtyText.set(sanitizeDigitsOnly(value));
  }

  confirmVoidItem(): void {
    if (!this.ledgerCanMutate()) {
      this.toast.showError('โต๊ะนี้ถูกเช็กบิลแล้ว ไม่สามารถแก้รายการได้');
      this.closeVoidItemModal();
      return;
    }
    const sessionId = this.selectedSeat()?.sessionId;
    const expectedRevision = this.requireExpectedRevision();
    const item = this.voidItemTarget();
    if (!sessionId || !item || expectedRevision == null) {
      this.toast.showError('ไม่พบรายการ');
      return;
    }
    const quantity = parsePositiveIntFromText(this.voidItemQtyText());
    if (quantity == null || quantity <= 0) {
      this.toast.showError('กรุณาระบุจำนวนที่ต้องการลบ');
      return;
    }
    if (quantity > item.quantity) {
      this.toast.showError(`ลบได้ไม่เกิน ${item.quantity} ${item.unitLabel}`);
      return;
    }
    const changeReason = this.requiredMutationChangeReason();
    if (!changeReason) return;
    this.submitBillPanelMutation(
      this.openTableService.voidSessionItems({
        shopId: this.shopId,
        sessionId,
        expectedRevision,
        changeReason,
        items: [
          {
            itemType: item.itemType,
            itemId: item.itemId,
            unitPrice: item.unitPrice,
            isFreeMixer: Boolean(item.isFreeMixer),
            unitLabelTh: item.unitLabelTh ?? item.unitLabel,
            ...(item.itemName ? { itemName: item.itemName } : {}),
            quantity,
          },
        ],
      }),
      'ลบรายการสำเร็จ — เพิ่มโปรหรือรายการใหม่ได้จากปุ่มเพิ่มรายการ',
      sessionId,
      () => this.closeVoidItemModal(),
    );
  }

  openDeleteStaffDrinkModal(row: SessionStaffDrink): void {
    this.resetMutationChangeReason();
    this.deleteStaffDrinkTarget.set(row);
    this.showDeleteStaffDrinkModal.set(true);
    this.showMobileSheet.set(false);
  }

  closeDeleteStaffDrinkModal(): void {
    this.showDeleteStaffDrinkModal.set(false);
    this.deleteStaffDrinkTarget.set(null);
    this.resetMutationChangeReason();
    this.schedulePortaledModalPurge();
    if (this.selectedSeatKey()) {
      this.showMobileSheet.set(true);
    }
  }

  confirmDeleteStaffDrink(): void {
    if (!this.ledgerCanMutate()) {
      this.toast.showError('โต๊ะนี้ถูกเช็กบิลแล้ว ไม่สามารถแก้รายการได้');
      this.closeDeleteStaffDrinkModal();
      return;
    }
    const sessionId = this.selectedSeat()?.sessionId;
    const expectedRevision = this.requireExpectedRevision();
    const row = this.deleteStaffDrinkTarget();
    if (!sessionId || !row || expectedRevision == null) {
      this.toast.showError('ไม่พบรายการรันดื่ม');
      return;
    }
    const changeReason = this.requiredMutationChangeReason();
    if (!changeReason) return;
    this.submitBillPanelMutation(
      this.openTableService.deleteStaffDrink({
        shopId: this.shopId,
        sessionId,
        expectedRevision,
        staffDrinkId: row.staffDrinkId,
        changeReason,
      }),
      'ลบรายการรันดื่มสำเร็จ',
      sessionId,
      () => this.closeDeleteStaffDrinkModal(),
    );
  }

  openEditStaffDrinkModal(row: SessionStaffDrink): void {
    this.resetMutationChangeReason();
    this.editStaffDrinkTarget.set(row);
    const stored = row.storedDrinksCount ?? row.drinks;
    this.editStaffDrinkQtyText.set(String(Math.max(0, stored)));
    this.showEditStaffDrinkModal.set(true);
    this.showMobileSheet.set(false);
  }

  closeEditStaffDrinkModal(): void {
    this.showEditStaffDrinkModal.set(false);
    this.editStaffDrinkTarget.set(null);
    this.resetMutationChangeReason();
    this.schedulePortaledModalPurge();
    if (this.selectedSeatKey()) {
      this.showMobileSheet.set(true);
    }
  }

  onEditStaffDrinkQtyChange(value: string): void {
    this.editStaffDrinkQtyText.set(sanitizeDigitsOnly(value));
  }

  confirmEditStaffDrink(): void {
    if (!this.ledgerCanMutate()) {
      this.toast.showError('โต๊ะนี้ถูกเช็กบิลแล้ว ไม่สามารถแก้รายการได้');
      this.closeEditStaffDrinkModal();
      return;
    }
    const sessionId = this.selectedSeat()?.sessionId;
    const expectedRevision = this.requireExpectedRevision();
    const row = this.editStaffDrinkTarget();
    if (!sessionId || !row || expectedRevision == null) {
      this.toast.showError('ไม่พบรายการรันดื่ม');
      return;
    }
    const digits = sanitizeDigitsOnly(this.editStaffDrinkQtyText());
    if (digits === '') {
      this.toast.showError('กรุณาระบุจำนวนดื่ม (0 = ลบรายการ)');
      return;
    }
    const drinksCount = Number.parseInt(digits, 10);
    if (!Number.isFinite(drinksCount) || drinksCount < 0) {
      this.toast.showError('จำนวนดื่มไม่ถูกต้อง');
      return;
    }
    const changeReason = this.requiredMutationChangeReason();
    if (!changeReason) return;
    this.submitBillPanelMutation(
      this.openTableService.adjustStaffDrink({
        shopId: this.shopId,
        sessionId,
        expectedRevision,
        staffDrinkId: row.staffDrinkId,
        drinksCount,
        changeReason,
      }),
      drinksCount === 0 ? 'ลบรายการรันดื่มสำเร็จ' : 'แก้ไขจำนวนดื่มสำเร็จ',
      sessionId,
      () => this.closeEditStaffDrinkModal(),
    );
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
    const changeReason = this.requiredMutationChangeReason();
    if (!changeReason) return;
    this.submitBillPanelMutation(
      this.openTableService.returnBeverage({
        shopId: this.shopId,
        sessionId,
        expectedRevision,
        itemId: item.itemId,
        unitPrice: item.unitPrice,
        isFreeMixer: Boolean(item.isFreeMixer),
        quantity,
        changeReason,
      }),
      'คืนเครื่องดื่มสำเร็จ',
      sessionId,
      () => this.closeReturnBeverageModal(),
    );
  }

  openCheckoutModal(): void {
    this.checkoutAt.set(currentDatetimeLocalValue());
    this.checkoutPaymentMethod.set('CASH');
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

  onCheckoutPaymentMethodChange(value: number | string | null): void {
    const method = String(value ?? '').trim().toUpperCase();
    if (isBillPaymentMethod(method)) {
      this.checkoutPaymentMethod.set(method);
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
    void this.confirmCheckoutAsync();
  }

  printPreCheckoutBill(): void {
    const sessionId = this.selectedSeat()?.sessionId;
    const checkedOutAt = this.resolvedCheckoutAt();
    if (!sessionId) {
      this.toast.showError('ไม่พบบิลที่เปิดอยู่');
      return;
    }
    if (!isValidShopDatetimeLocal(checkedOutAt)) {
      this.toast.showError('กรุณาระบุเวลาเช็กบิล');
      return;
    }
    if (!this.checkoutPreview()) {
      this.toast.showError('กรุณารอสรุปยอดก่อนพิมพ์');
      return;
    }
    if (this.checkoutPrintBusy()) return;

    const printFrame = this.billReceiptService.shouldPreparePrintFrame()
      ? this.billReceiptService.createPrintFrame()
      : null;

    this.checkoutPrintBusy.set(true);
    this.openTableService
      .previewCheckoutReceipt({
        shopId: this.shopId,
        sessionId,
        checkedOutAt,
        browserPng: this.billReceiptService.shouldPreparePrintFrame(),
      })
      .pipe(
        finalize(() => this.checkoutPrintBusy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          this.tryPrintCheckoutReceipt(response, printFrame);
        },
        error: (err: { error?: { error?: string } }) => {
          this.billReceiptService.removePrintFrame(printFrame);
          this.toast.showError(err.error?.error ?? 'ไม่สามารถพิมพ์ใบแจ้งยอดได้');
        },
      });
  }

  private async confirmCheckoutAsync(): Promise<void> {
    const sessionId = this.selectedSeat()?.sessionId;
    const expectedRevision = this.requireExpectedRevision();
    if (!sessionId || expectedRevision == null) {
      this.toast.showError('ไม่พบบิลที่เปิดอยู่');
      return;
    }
    const checkedOutAt = this.resolvedCheckoutAt();
    if (!isValidShopDatetimeLocal(checkedOutAt)) {
      this.toast.showError('กรุณาระบุเวลาเช็กบิล');
      return;
    }

    const preview = this.checkoutPreview();
    if (!preview) {
      this.toast.showError('กรุณารอสรุปยอดก่อนเช็กบิล');
      return;
    }

    const paymentLabel = billPaymentMethodLabel(this.checkoutPaymentMethod());
    const ok = await this.confirmDialog.confirm({
      title: 'ยืนยันเช็กบิล',
      message: `เช็กบิลเวลา ${this.formatShopDatetimeLabel(checkedOutAt)} · ${paymentLabel} · ยอดรวม ${preview.billAmount.toLocaleString('th-TH')} บาท ใช่หรือไม่?`,
      confirmLabel: 'เช็กบิล',
    });
    if (!ok) return;

    const printFrame = this.billReceiptService.shouldPreparePrintFrame()
      ? this.billReceiptService.createPrintFrame()
      : null;

    this.runAction(
      this.openTableService.checkoutBill({
        shopId: this.shopId,
        sessionId,
        expectedRevision,
        checkedOutAt,
        paymentMethod: this.checkoutPaymentMethod(),
        releaseSeat: false,
        browserPng: this.billReceiptService.shouldPreparePrintFrame(),
      }),
      'เช็กบิลสำเร็จ',
      (result) => {
        this.closeCheckoutModal();
        this.lastCheckoutBillId.set(result.billId);
        this.tryPrintCheckoutReceipt(result.receipt, printFrame);
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
          this.reloadStaffEmployees();
        }
      },
      () => {
        this.billReceiptService.removePrintFrame(printFrame);
        this.closeCheckoutModal();
        this.closeAddModal();
      },
    );
  }

  /** Railway/cloud API cannot reach printers — print on the device at the shop. */
  private tryPrintCheckoutReceipt(
    receiptResponse: BillReceiptResponse | undefined,
    printFrame?: HTMLIFrameElement | null,
  ): void {
    if (!receiptResponse) {
      this.billReceiptService.removePrintFrame(printFrame);
      return;
    }

    const channel = receiptResponse.receipt.printChannel ?? 'auto';
    if (channel === 'off') {
      this.billReceiptService.removePrintFrame(printFrame);
      return;
    }

    const outcome = this.billReceiptService.printReceipt(receiptResponse.receipt, {
      printFrame,
    });
    if (outcome.ok && outcome.method === 'thermer') {
      this.toast.showSuccess(
        outcome.message ?? 'กำลังส่งใบเสร็จไป Thermer...',
      );
      return;
    }
    if (outcome.ok && outcome.method === 'rawbt') {
      const isIos = /iPad|iPhone|iPod/i.test(navigator.userAgent);
      this.toast.showSuccess(
        isIos
          ? 'ส่งไปแอปพิมพ์แล้ว — กดพิมพ์ในแอป (ครั้งแรกต้องจับคู่ BT)'
          : 'ส่งไป RawBT แล้ว — กดพิมพ์ในแอป (ครั้งแรกต้องจับคู่ BT)',
      );
      return;
    }
    if (outcome.ok && outcome.method === 'browser') {
      this.toast.showSuccess(
        outcome.message ??
          (detectReceiptPrintPlatform() !== 'desktop'
            ? 'แสดงใบเสร็จแล้ว — กดปุ่ม พิมพ์ ด้านล่าง'
            : 'เปิดหน้าพิมพ์แล้ว — เลือกเครื่องพิมพ์ POS-58'),
      );
      return;
    }
    if (!outcome.ok) {
      this.toast.showError(outcome.message ?? 'เปิดหน้าพิมพ์ไม่ได้ — ลองกดพิมพ์ใบเสร็จอีกครั้ง');
    }
  }

  reprintLastReceipt(): void {
    const billId = this.reprintBillId();
    if (billId == null) {
      this.toast.showError('ไม่พบบิลล่าสุด — เช็กบิลใหม่หรือเปิดโต๊ะนี้อีกครั้ง');
      return;
    }

    const printFrame = this.billReceiptService.shouldPreparePrintFrame()
      ? this.billReceiptService.createPrintFrame()
      : null;

    this.billReceiptService.getBillReceipt(billId).subscribe({
      next: (response) => {
        const outcome = this.billReceiptService.printReceipt(response.receipt, {
          printFrame,
        });
        if (outcome.ok && outcome.method === 'thermer') {
      this.toast.showSuccess(
        outcome.message ?? 'กำลังส่งใบเสร็จไป Thermer...',
      );
      return;
    }
    if (outcome.ok && outcome.method === 'rawbt') {
          this.toast.showSuccess('ส่งไป RawBT แล้ว');
          return;
        }
        if (outcome.ok && outcome.method === 'browser') {
          this.toast.showSuccess(
            outcome.message ??
              (detectReceiptPrintPlatform() !== 'desktop'
                ? 'แสดงใบเสร็จแล้ว — กดปุ่ม พิมพ์ ด้านล่าง'
                : 'เปิดหน้าพิมพ์แล้ว — เลือกเครื่องพิมพ์ POS-58'),
          );
          return;
        }
        if (!outcome.ok) {
          this.toast.showError(outcome.message ?? 'พิมพ์ใบเสร็จไม่สำเร็จ');
        }
      },
      error: () => {
        this.billReceiptService.removePrintFrame(printFrame);
        this.toast.showError('โหลดใบเสร็จไม่สำเร็จ');
      },
    });
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
        this.refreshFloorPlan(null, { skeleton: true });
        this.reloadStaffEmployees();
      },
    );
  }

  private formatShopDatetimeLabel(shopDatetime: string): string {
    const { datePart, hour, minute } = splitShopDatetimeLocal(shopDatetime);
    return `${formatShopDatetimeLabelBe(`${datePart}T${hour}:${minute}`)} น.`;
  }

  private resolvedStopSeatTime(): string {
    const picker = this.stopDatetimeInput();
    const value = picker?.commitPendingToModel() ?? this.stopSeatTime();
    this.stopSeatTime.set(value);
    return value.trim();
  }

  private resolvedCheckoutAt(): string {
    const picker = this.checkoutDatetimeInput();
    const value = picker?.commitPendingToModel() ?? this.checkoutAt();
    this.checkoutAt.set(value);
    return value.trim();
  }

  private flushAddModalDatetimes(): void {
    const staffValue = this.staffSeatDatetimeInput()?.commitPendingToModel();
    if (staffValue) {
      this.staffSeatStartedAt.set(staffValue);
    }
    const roomValue = this.roomSeatDatetimeInput()?.commitPendingToModel();
    if (roomValue) {
      this.roomSeatStartedAt.set(roomValue);
    }
  }

  private buildRoomChargeConfirmMessage(
    seatingId: number,
    rateType: RoomChargeRateMode,
    unitPrice: number,
    seatStartedAt: string,
  ): string {
    const seatCode = this.seats().find((s) => s.seatId === seatingId)?.code ?? '—';
    const rateLabel =
      ROOM_CHARGE_MODE_OPTIONS.find((option) => option.value === rateType)?.label ?? rateType;
    const pricePart =
      rateType === 'HOURLY' || rateType === 'FLAT_RATE'
        ? ` · ${unitPrice.toLocaleString('th-TH')} บาท`
        : '';
    return `เพิ่มค่าห้องที่นั่ง ${seatCode} · ${rateLabel}${pricePart} · เริ่ม ${this.formatShopDatetimeLabel(seatStartedAt)} ใช่หรือไม่?`;
  }

  private buildStaffLedgerConfirmMessage(): string {
    const employee = this.selectedStaffLedgerEmployee();
    const name = employee?.nickname ?? '—';
    const role = this.selectedStaffLedgerRole();
    if (this.staffLedgerEntryMode() === 'OFF_DUTY_PURCHASE') {
      const qty = parsePositiveIntFromText(this.staffLedgerQtyText()) ?? 0;
      return `บันทึกซื้อดื่มหยุด ${name} · ${qty.toLocaleString('th-TH')} ดื่ม ใช่หรือไม่?`;
    }
    if (role && isEntertainmentStaffRole(role)) {
      const seatLocal = this.staffSeatStartedAt().trim();
      return `บันทึกรันดื่ม ${name} · เริ่มนั่ง ${this.formatShopDatetimeLabel(seatLocal)} ใช่หรือไม่?`;
    }
    const qty = parsePositiveIntFromText(this.staffLedgerQtyText()) ?? 0;
    return `บันทึกรันดื่ม ${name} · ${qty.toLocaleString('th-TH')} ดื่ม ใช่หรือไม่?`;
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
        // Clear busy before closing portaled modals — otherwise a detached overlay can
        // freeze on "กำลังบันทึก..." while finalize runs on the live component.
        this.actionBusy.set(false);
        this.toast.showSuccess(successMessage);
        try {
          onSuccess(result);
        } catch {
          this.purgePortaledModalsWhenNoneOpen();
        }
      });
  }
}

function readFloorDisplayMode(): FloorDisplayMode {
  try {
    const raw = localStorage.getItem(FLOOR_DISPLAY_MODE_KEY);
    if (raw === 'layout' || raw === 'grid') return raw;
  } catch {
    /* ignore */
  }
  return 'grid';
}
