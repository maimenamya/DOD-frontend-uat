import type { RoomChargeRateMode } from '../../models/room-charge';

/** Per-card choices on the staff-drink grid (รันดื่ม). */
export type StaffGridCardState = {
  useFree: boolean;
  asTag: boolean;
  reopenNew: boolean;
  qty: number;
  startedAt: string;
};

/** Per-card choices on the room-charge grid. */
export type RoomGridCardState = {
  rateType: RoomChargeRateMode;
  priceText: string;
  qty: number;
  startedAt: string;
};

/** Per-card choices on the cocktail grid. */
export type CocktailGridCardState = {
  roleId: number | null;
  employeeId: number | null;
  qty: number;
};

export function defaultStaffGridState(
  hasActivePrTag: boolean,
  startedAt: string,
): StaffGridCardState {
  return {
    useFree: false,
    asTag: hasActivePrTag,
    reopenNew: false,
    qty: 0,
    startedAt,
  };
}

export function defaultRoomGridState(startedAt: string): RoomGridCardState {
  return {
    rateType: 'NONE',
    priceText: '',
    qty: 0,
    startedAt,
  };
}

export function defaultCocktailGridState(
  roleId: number | null,
  employeeId: number | null,
): CocktailGridCardState {
  return { roleId, employeeId, qty: 0 };
}
