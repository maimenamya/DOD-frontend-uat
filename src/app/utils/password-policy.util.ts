/** Keep in sync with backend `password-policy.util.ts`. */
export const MIN_PASSWORD_LENGTH = 8;

/** Digits + uppercase without ambiguous 0/O/1/I — easy to read aloud. */
const SHOP_INITIAL_PASSWORD_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function passwordPolicyErrorMessage(): string {
  return `รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`;
}

export function passwordMeetsPolicy(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}

/** Random shop-wide initial password for shop rules (editable after). */
export function generateShopInitialPassword(length = MIN_PASSWORD_LENGTH): string {
  const size = Math.max(MIN_PASSWORD_LENGTH, length);
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < size; i += 1) {
    out += SHOP_INITIAL_PASSWORD_ALPHABET[bytes[i]! % SHOP_INITIAL_PASSWORD_ALPHABET.length];
  }
  return out;
}
