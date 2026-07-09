/** Decode JWT `exp` (seconds) without verifying signature — client-side hint only. */
export function jwtExpiresAtMs(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const payload = JSON.parse(atob(padded)) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isJwtExpired(token: string, nowMs = Date.now()): boolean {
  const expiresAtMs = jwtExpiresAtMs(token);
  if (expiresAtMs === null) {
    return false;
  }
  return nowMs >= expiresAtMs;
}
