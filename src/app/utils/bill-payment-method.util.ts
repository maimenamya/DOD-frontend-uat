import type { DropdownOption } from '../components/custom-dropdown/custom-dropdown.component';

export type BillPaymentMethod = 'CASH' | 'PROMPTPAY' | 'CREDIT_CARD';

export const BILL_PAYMENT_METHOD_LABELS: Record<BillPaymentMethod, string> = {
  CASH: 'เงินสด',
  PROMPTPAY: 'พร้อมเพย์',
  CREDIT_CARD: 'บัตรเครดิต',
};

export const CHECKOUT_PAYMENT_METHOD_OPTIONS: DropdownOption[] = (
  Object.entries(BILL_PAYMENT_METHOD_LABELS) as [BillPaymentMethod, string][]
).map(([value, label]) => ({ value, label }));

export function billPaymentMethodLabel(method: BillPaymentMethod): string {
  return BILL_PAYMENT_METHOD_LABELS[method];
}
