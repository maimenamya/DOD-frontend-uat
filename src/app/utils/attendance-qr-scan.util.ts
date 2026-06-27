/** Extract attendance punch token from kiosk QR (URL or raw token). */
export function parseAttendancePunchTokenFromQr(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    const url = trimmed.startsWith('http')
      ? new URL(trimmed)
      : new URL(trimmed, window.location.origin);
    if (url.pathname.includes('/attendance/punch')) {
      const token = url.searchParams.get('t')?.trim();
      if (token) return token;
    }
  } catch {
    // not a URL — try raw token below
  }

  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}
