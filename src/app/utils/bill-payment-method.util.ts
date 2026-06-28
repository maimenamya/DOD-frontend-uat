import type { DropdownOption } from '../components/custom-dropdown/custom-dropdown.component';

export type BillPaymentMethod = 'CASH' | 'PROMPTPAY' | 'CREDIT_CARD' | 'PENDING_PAYMENT';

export const BILL_PAYMENT_METHOD_LABELS: Record<BillPaymentMethod, string> = {
  CASH: 'เงินสด',
  PROMPTPAY: 'พร้อมเพย์',
  CREDIT_CARD: 'บัตรเครดิต',
  PENDING_PAYMENT: 'ค้างชำระ',
};

export const CHECKOUT_PAYMENT_METHOD_OPTIONS: DropdownOption[] = (
  Object.entries(BILL_PAYMENT_METHOD_LABELS) as [BillPaymentMethod, string][]
).map(([value, label]) => ({ value, label }));

export function isBillPaymentMethod(value: string): value is BillPaymentMethod {
  return value in BILL_PAYMENT_METHOD_LABELS;
}

export function billPaymentMethodLabel(method: BillPaymentMethod): string {
  return BILL_PAYMENT_METHOD_LABELS[method];
}
