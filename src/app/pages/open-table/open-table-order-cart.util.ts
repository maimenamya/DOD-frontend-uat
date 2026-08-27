import type { AddItemsPayload } from '../../models/open-table';

export type OrderPickerMode = 'classic' | 'grid';

export type OrderGridItemType = 'FOOD' | 'DRINK' | 'PROMOTION' | 'MEMBERSHIP' | 'OTHER';

export type OrderGridCard = {
  id: number;
  name: string;
  price: number;
  priceLabel: string;
  imageUrl: string | null;
  isMixer: boolean;
  type: OrderGridItemType;
  allowDeposit?: boolean;
};

export type OrderCartLine = {
  key: string;
  itemId: number;
  type: OrderGridItemType;
  name: string;
  quantity: number;
  unitPrice: number;
  imageUrl?: string | null;
  isFreeMixer?: boolean;
  allowDeposit?: boolean;
};

const MAX_LINE_QTY = 99;

export function orderCartLineKey(input: {
  type: OrderGridItemType;
  itemId: number;
  isFreeMixer?: boolean;
}): string {
  if (input.type === 'DRINK') {
    return `DRINK:${input.itemId}:${input.isFreeMixer ? '1' : '0'}`;
  }
  return `${input.type}:${input.itemId}`;
}

export function bumpOrderCartLine(
  lines: OrderCartLine[],
  next: Omit<OrderCartLine, 'quantity' | 'key'> & { key?: string },
  delta: number,
): OrderCartLine[] {
  const key =
    next.key ??
    orderCartLineKey({
      type: next.type,
      itemId: next.itemId,
      isFreeMixer: next.isFreeMixer,
    });
  const current = lines.find((row) => row.key === key);
  const quantity = (current?.quantity ?? 0) + delta;
  if (quantity < 1) {
    return lines.filter((row) => row.key !== key);
  }
  const clamped = Math.min(MAX_LINE_QTY, quantity);
  const line: OrderCartLine = {
    ...next,
    key,
    quantity: clamped,
  };
  if (!current) {
    return [...lines, line];
  }
  return lines.map((row) => (row.key === key ? line : row));
}

export function orderCartToAddItems(lines: OrderCartLine[]): AddItemsPayload['items'] {
  return lines.map((row) => ({
    itemId: row.itemId,
    quantity: row.quantity,
    type: row.type,
    ...(row.type === 'DRINK' && row.isFreeMixer ? { isFreeMixer: true } : {}),
    ...(row.type === 'PROMOTION' || row.type === 'MEMBERSHIP'
      ? { packageDepositMode: 'NEW' as const }
      : {}),
  }));
}
