export type FloorLayoutShape = 'RECT_H' | 'RECT_V' | 'SQUARE' | 'CIRCLE';

export type FloorLayoutPlacedSeat = {
  id: number;
  seatingId: number;
  code: string;
  seatingTypeId: number | null;
  seatingTypeName: string | null;
  posX: number;
  posY: number;
  shape: FloorLayoutShape;
  width: number;
  height: number;
};

export type FloorLayoutUnplacedSeat = {
  seatingId: number;
  code: string;
  seatingTypeId: number;
  seatingTypeName: string;
};

export type FloorLayoutZone = {
  id: number;
  name: string;
  code: string;
};

export type FloorLayoutArea = {
  /** Stable client key (server id or temp). */
  key: string;
  id: number;
  seatingTypeId: number;
  name: string;
  posX: number;
  posY: number;
  width: number;
  height: number;
};

export type FloorLayoutBoard = {
  canvasWidth: number;
  canvasHeight: number;
  zones: FloorLayoutZone[];
  placed: FloorLayoutPlacedSeat[];
  unplaced: FloorLayoutUnplacedSeat[];
  areas?: FloorLayoutArea[];
};

export type FloorLayoutWriteItem = {
  seatingId: number;
  posX: number;
  posY: number;
  shape: FloorLayoutShape;
  width: number;
  height: number;
};

export type FloorLayoutAreaWriteItem = {
  seatingTypeId: number;
  name: string;
  posX: number;
  posY: number;
  width: number;
  height: number;
};

export const DEFAULT_FLOOR_SEAT_WIDTH = 40;
export const DEFAULT_FLOOR_SEAT_HEIGHT = 40;
export const DEFAULT_FLOOR_AREA_WIDTH = 120;
export const DEFAULT_FLOOR_AREA_HEIGHT = 80;

export const FLOOR_LAYOUT_SHAPE_OPTIONS: Array<{ value: FloorLayoutShape; label: string }> = [
  { value: 'SQUARE', label: 'สี่เหลี่ยม' },
  { value: 'CIRCLE', label: 'วงกลม' },
];

/** Legacy RECT_H / RECT_V → สี่เหลี่ยม (ขนาดกำหนดด้วย width/height แล้ว). */
export function normalizeFloorLayoutShape(shape: string | null | undefined): FloorLayoutShape {
  return shape === 'CIRCLE' ? 'CIRCLE' : 'SQUARE';
}

/**
 * Seat box on the floor canvas — fixed design pixels (canvas is also fixed size).
 * Editor and POS share this so tables never scale with the viewport.
 */
export function floorLayoutSeatBoxStyle(
  posX: number,
  posY: number,
  shape: FloorLayoutShape,
  width: number,
  height: number,
): Record<string, string> {
  return {
    left: `${Math.round(posX)}px`,
    top: `${Math.round(posY)}px`,
    width: `${Math.round(width)}px`,
    height: `${Math.round(height)}px`,
    borderRadius: shape === 'CIRCLE' ? '999px' : '8px',
  };
}

export function floorLayoutAreaBoxStyle(
  posX: number,
  posY: number,
  width: number,
  height: number,
): Record<string, string> {
  return {
    left: `${Math.round(posX)}px`,
    top: `${Math.round(posY)}px`,
    width: `${Math.round(width)}px`,
    height: `${Math.round(height)}px`,
  };
}

export function mapFloorLayoutAreasFromApi(
  rows: Array<{
    id: number;
    seatingTypeId: number;
    name: string;
    posX: number;
    posY: number;
    width: number;
    height: number;
  }> | null | undefined,
): FloorLayoutArea[] {
  return (rows ?? []).map((row) => ({
    key: `area-${row.id}`,
    id: row.id,
    seatingTypeId: row.seatingTypeId,
    name: row.name,
    posX: row.posX,
    posY: row.posY,
    width: row.width,
    height: row.height,
  }));
}

export function clampFloorLayoutEdge(n: number, fallback = DEFAULT_FLOOR_SEAT_WIDTH): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.round(n), 24), 600);
}
