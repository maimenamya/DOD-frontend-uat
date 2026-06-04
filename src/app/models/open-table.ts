import type { SeatingRateType } from './seating';

export type SeatStatus = 'AVAILABLE' | 'OCCUPIED' | 'AWAITING_CLEAR';

export type FloorPlanSeat = {
  id: number;
  code: string;
  status: SeatStatus;
  seatingTypeId: number;
  chargesRoomFee: boolean;
  sessionId: number | null;
  sessionRevision: number | null;
  saleName: string | null;
};

export type FloorPlanSeatingType = {
  id: number;
  name: string;
  code: string;
  description: string | null;
  rateType: SeatingRateType;
  basePrice: number;
  minimumSpend: number;
  seats: FloorPlanSeat[];
};

export type OpenTableFloorPlan = {
  seatingTypes: FloorPlanSeatingType[];
  seatings: FloorPlanSeat[];
};

export type SessionOrderItem = {
  itemId: number;
  itemType: 'BEVERAGE' | 'FOOD' | 'PROMOTION' | 'MEMBERSHIP' | 'COCKTAIL' | 'OTHER';
  /** Stored name for void matching (cocktails include host suffix). */
  itemName?: string;
  label: string;
  hostLabel?: string;
  quantity: number;
  unitLabel: string;
  unitLabelTh?: string;
  unitPrice: number;
  isFreeMixer?: boolean;
  isCocktailHost?: boolean;
  canReturn?: boolean;
  canVoid?: boolean;
};

export type VoidSessionItemsPayload = SessionMutationBase & {
  items: Array<{
    itemType: SessionOrderItem['itemType'];
    itemId: number;
    unitPrice: number;
    isFreeMixer: boolean;
    unitLabelTh: string;
    itemName?: string;
    quantity: number;
  }>;
};

export type SessionMutationBase = {
  shopId: number;
  sessionId: number;
  expectedRevision: number;
};

export type ReturnBeveragePayload = SessionMutationBase & {
  itemId: number;
  unitPrice: number;
  isFreeMixer: boolean;
  quantity: number;
};

export type AddRoomChargePayload = SessionMutationBase & {
  seatingId: number;
  rateType: 'NONE' | 'HOURLY' | 'FLAT_RATE';
  unitPrice: number;
  seatStartedAt?: string;
};

export type SessionRoomCharge = {
  roomChargeId: number;
  roomCode: string;
  priceLabel?: string;
  /** Checkout detail when multiple rates in one seating line, e.g. "@ 200/100 บาท" */
  rateDetail?: string;
  pricingType: SeatingRateType;
  quantity: number;
  unitLabel: string;
  unitPrice: number;
  lineAmount: number;
  seatStartedLabel: string;
  seatStoppedLabel?: string;
  canStop: boolean;
};

export type StopRoomChargePayload = SessionMutationBase & {
  roomChargeId: number;
  seatStoppedAt: string;
};

export type SessionStaffDrink = {
  staffDrinkId: number;
  employeeRecordId: number;
  employeeName: string;
  roleDisplayNameTh: string;
  drinks: number;
  drinkAmount: number;
  seatStartedLabel?: string;
  seatStoppedLabel?: string;
  canStopDrinks?: boolean;
  note?: string;
};

export type StopStaffDrinkPayload = SessionMutationBase & {
  staffDrinkId: number;
  seatStoppedAt: string;
};

export type StopStaffDrinkPreviewPayload = {
  shopId: number;
  sessionId: number;
  staffDrinkId: number;
  seatStoppedAt: string;
};

export type StopStaffDrinkPreview = {
  seatStoppedLabel: string;
  currentDrinks: number;
  projectedDrinks: number;
  projectedAmount: number;
  completedHours: number;
  baseDrinks: number;
  hourDrinks: number;
  detail: string;
};

export type TxnActiveSessionStatus = 'OPEN' | 'BILLED';

export type OpenTableSessionDetail = {
  sessionId: number;
  revision: number;
  sessionStatus?: TxnActiveSessionStatus;
  lastCheckedOutLabel?: string;
  canReleaseCustomer?: boolean;
  /** False after checkout — no new items/transfers until seat released. */
  canMutateLedger?: boolean;
  seatKey: string | null;
  seatCode: string | null;
  seatingTypeName?: string | null;
  seatingTypeCode?: string | null;
  seatingTypeRateType?: SeatingRateType | null;
  saleName: string;
  items: SessionOrderItem[];
  roomCharges?: SessionRoomCharge[];
  staffDrinks: SessionStaffDrink[];
  totalDrinks: number;
  totalAmount: number;
};

export type CheckInPayload = {
  shopId: number;
  seatingId: number;
  salesId: number;
};

export type SessionOrderItemType =
  | 'FOOD'
  | 'DRINK'
  | 'COCKTAIL'
  | 'PROMOTION'
  | 'MEMBERSHIP'
  | 'OTHER';

export type AddItemsPayload = SessionMutationBase & {
  items: Array<{
    itemId: number;
    quantity: number;
    type: SessionOrderItemType;
    hostEmployeeId?: number;
  }>;
  staffDrinks: Array<{
    employeeId: number;
    drinkId?: number;
    beverageId?: number;
    quantity?: number;
    seatStartedAt?: string;
    /** Charge role startDrinks at seat-down (PR/entertainer). */
    applyStartDrinks?: boolean;
  }>;
};

export type TransferSeatPayload = SessionMutationBase & {
  sourceSeatingId: number;
  destinationSeatingId: number;
};

export type CheckoutPreviewPayload = {
  shopId: number;
  sessionId: number;
  checkedOutAt: string;
};

export type CheckoutPayload = SessionMutationBase & {
  checkedOutAt: string;
  releaseSeat?: boolean;
};

export type CheckoutPreviewLine = {
  label: string;
  detail: string;
  amount: number;
};

export type CheckoutPreview = {
  checkedOutLabel: string;
  ledgerLines: CheckoutPreviewLine[];
  drinkLines: CheckoutPreviewLine[];
  itemsSubtotal: number;
  roomSubtotal: number;
  drinksSubtotal: number;
  billAmount: number;
  totalDrinks: number;
};

export type CheckoutResult = {
  billId: number;
  billReference: string;
  billAmount: number;
  totalDrinks: number;
  checkedOutLabel?: string;
  sessionClosed: boolean;
};

export type ReleaseCustomerPayload = SessionMutationBase;

export type TxnActiveSessionRecord = {
  id: number;
  shopId: number;
  seatingId: number | null;
  saleEmployeeId: string;
  revision: number;
  createdAt: string;
};
