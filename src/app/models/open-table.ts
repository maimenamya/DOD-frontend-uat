import type { SeatingRateType } from './seating';

export type SeatStatus = 'AVAILABLE' | 'OCCUPIED' | 'AWAITING_CLEAR';

export type FloorPlanSeat = {
  id: number;
  code: string;
  status: SeatStatus;
  seatingTypeId: number;
  sessionId: number | null;
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
  label: string;
  hostLabel?: string;
  quantity: number;
  unitLabel: string;
  unitPrice: number;
  isFreeMixer?: boolean;
  isCocktailHost?: boolean;
  canReturn?: boolean;
};

export type ReturnBeveragePayload = {
  shopId: number;
  sessionId: number;
  itemId: number;
  unitPrice: number;
  isFreeMixer: boolean;
  quantity: number;
};

export type SessionRoomCharge = {
  roomChargeId: number;
  roomCode: string;
  pricingType: SeatingRateType;
  quantity: number;
  unitLabel: string;
  unitPrice: number;
  lineAmount: number;
  seatStartedLabel: string;
  seatStoppedLabel?: string;
  canStop: boolean;
};

export type StopRoomChargePayload = {
  shopId: number;
  sessionId: number;
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

export type StopStaffDrinkPayload = {
  shopId: number;
  sessionId: number;
  staffDrinkId: number;
  seatStoppedAt: string;
};

export type TxnActiveSessionStatus = 'OPEN' | 'BILLED';

export type OpenTableSessionDetail = {
  sessionId: number;
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

export type AddItemsPayload = {
  shopId: number;
  sessionId: number;
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
  }>;
};

export type TransferSeatPayload = {
  shopId: number;
  sourceSeatingId: number;
  destinationSeatingId: number;
};

export type CheckoutPayload = {
  shopId: number;
  sessionId: number;
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

export type ReleaseCustomerPayload = {
  shopId: number;
  sessionId: number;
};

export type TxnActiveSessionRecord = {
  id: number;
  shopId: number;
  seatingId: number | null;
  saleEmployeeId: string;
  createdAt: string;
};
