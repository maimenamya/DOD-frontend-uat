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

const SIZE_BASE: Record<FloorLayoutSize, number> = { S: 56, M: 80, L: 112 };

export function floorLayoutBoxSize(
  shape: FloorLayoutShape,
  size: FloorLayoutSize,
): { width: number; height: number } {
  const base = SIZE_BASE[size];
  switch (shape) {
    case 'RECT_H':
      return { width: Math.round(base * 1.45), height: Math.round(base * 0.72) };
    case 'RECT_V':
      return { width: Math.round(base * 0.72), height: Math.round(base * 1.45) };
    case 'CIRCLE':
    case 'SQUARE':
    default:
      return { width: base, height: base };
  }
}
