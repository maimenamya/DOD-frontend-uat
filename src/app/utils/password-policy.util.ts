/** Keep in sync with backend `password-policy.util.ts`. */
export const MIN_PASSWORD_LENGTH = 8;

export function passwordPolicyErrorMessage(): string {
  return `รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`;
}

export function passwordMeetsPolicy(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}
