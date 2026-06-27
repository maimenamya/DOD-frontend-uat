/** Full app path for the shop-scoped attendance kiosk (QR display). */
export function attendanceKioskPath(publicId: string): string[] {
  const trimmed = publicId.trim();
  return ['/s', trimmed, 'attendance-kiosk'];
}

export function attendanceKioskUrl(publicId: string): string {
  const trimmed = publicId.trim();
  if (!trimmed || typeof window === 'undefined') {
    return '';
  }
  const origin = window.location.origin.replace(/\/+$/, '');
  return `${origin}/s/${encodeURIComponent(trimmed)}/attendance-kiosk`;
}
