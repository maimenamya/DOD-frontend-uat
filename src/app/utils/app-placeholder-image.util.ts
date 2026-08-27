/** Current D-rink PWA / app icon — used when a menu or profile photo is missing. */
export const APP_BRAND_ICON_SRC = '/icon-192-v4.png';

export function isUsableImageUrl(url: string | null | undefined): boolean {
  return typeof url === 'string' && url.trim().length > 0;
}
