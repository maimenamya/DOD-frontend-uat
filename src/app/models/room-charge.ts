import type { SeatingRateType } from './seating';

export type RoomChargeRateMode = 'NONE' | 'HOURLY' | 'FLAT_RATE';

export const ROOM_CHARGE_MODE_OPTIONS: { value: RoomChargeRateMode; label: string }[] = [
  { value: 'NONE', label: 'ไม่มีค่าใช้จ่าย' },
  { value: 'HOURLY', label: 'ชั่วโมงละ' },
  { value: 'FLAT_RATE', label: 'เหมาทั้งคืน' },
];

export function roomChargeModeLabel(mode: SeatingRateType | RoomChargeRateMode): string {
  if (mode === 'HOURLY') return 'ชั่วโมงละ';
  if (mode === 'FLAT_RATE') return 'เหมาทั้งคืน';
  if (mode === 'NONE') return 'ไม่มีค่าใช้จ่าย';
  return '—';
}
