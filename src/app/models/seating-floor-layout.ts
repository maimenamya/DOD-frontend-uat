export type FloorLayoutShape = 'RECT_H' | 'RECT_V' | 'SQUARE' | 'CIRCLE';
export type FloorLayoutSize = 'S' | 'M' | 'L';

export type FloorLayoutPlacedSeat = {
  id: number;
  seatingId: number;
  code: string;
  seatingTypeId: number | null;
  seatingTypeName: string | null;
  posX: number;
  posY: number;
  shape: FloorLayoutShape;
  size: FloorLayoutSize;
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

export type FloorLayoutBoard = {
  canvasWidth: number;
  canvasHeight: number;
  zones: FloorLayoutZone[];
  placed: FloorLayoutPlacedSeat[];
  unplaced: FloorLayoutUnplacedSeat[];
};

export type FloorLayoutWriteItem = {
  seatingId: number;
  posX: number;
  posY: number;
  shape: FloorLayoutShape;
  size: FloorLayoutSize;
};

export const FLOOR_LAYOUT_SHAPE_OPTIONS: Array<{ value: FloorLayoutShape; label: string }> = [
  { value: 'RECT_H', label: 'สี่เหลี่ยมผืนผ้า (แนวนอน)' },
  { value: 'RECT_V', label: 'สี่เหลี่ยมผืนผ้า (แนวตั้ง)' },
  { value: 'SQUARE', label: 'สี่เหลี่ยมจัตุรัส' },
  { value: 'CIRCLE', label: 'วงกลม' },
];

export const FLOOR_LAYOUT_SIZE_OPTIONS: Array<{ value: FloorLayoutSize; label: string }> = [
  { value: 'S', label: 'เล็ก' },
  { value: 'M', label: 'กลาง' },
  { value: 'L', label: 'ใหญ่' },
];

/** Short edge in canvas px — long = 2× (RECT 10∶5, square/circle 5∶5). */
const SHORT_EDGE: Record<FloorLayoutSize, number> = { S: 28, M: 40, L: 56 };

/**
 * Shared short edge so sizes match across shapes (user units 5 / 10):
 * RECT_H = 10×5, RECT_V = 5×10, SQUARE/CIRCLE = 5×5.
 */
export function floorLayoutBoxSize(
  shape: FloorLayoutShape,
  size: FloorLayoutSize,
): { width: number; height: number } {
  const short = SHORT_EDGE[size];
  const long = short * 2;
  switch (shape) {
    case 'RECT_H':
      return { width: long, height: short };
    case 'RECT_V':
      return { width: short, height: long };
    case 'CIRCLE':
    case 'SQUARE':
    default:
      return { width: short, height: short };
  }
}
