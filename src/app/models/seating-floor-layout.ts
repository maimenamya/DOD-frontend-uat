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

const SIZE_BASE: Record<FloorLayoutSize, number> = { S: 40, M: 56, L: 80 };

/** Long/short edges — exact swap so RECT_H is RECT_V rotated (ratio 2.5∶1). */
const RECT_LONG = 1.75;
const RECT_SHORT = 0.7;

export function floorLayoutBoxSize(
  shape: FloorLayoutShape,
  size: FloorLayoutSize,
): { width: number; height: number } {
  const base = SIZE_BASE[size];
  switch (shape) {
    case 'RECT_H':
      return { width: Math.round(base * RECT_LONG), height: Math.round(base * RECT_SHORT) };
    case 'RECT_V':
      return { width: Math.round(base * RECT_SHORT), height: Math.round(base * RECT_LONG) };
    case 'CIRCLE':
    case 'SQUARE':
    default:
      return { width: base, height: base };
  }
}
