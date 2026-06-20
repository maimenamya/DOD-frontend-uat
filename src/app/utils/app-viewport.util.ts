/** Viewports below 800px use mobile shell (sidebar overlay, open-table sheet, etc.). */
export const APP_MOBILE_MAX_WIDTH_PX = 799;

export const APP_DESKTOP_MIN_WIDTH_PX = 800;

export const APP_MOBILE_MEDIA_QUERY = `(max-width: ${APP_MOBILE_MAX_WIDTH_PX}px)` as const;

export const APP_DESKTOP_MEDIA_QUERY = `(min-width: ${APP_DESKTOP_MIN_WIDTH_PX}px)` as const;

export function isAppMobileViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(APP_MOBILE_MEDIA_QUERY).matches;
}
