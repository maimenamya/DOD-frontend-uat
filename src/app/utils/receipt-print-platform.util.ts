export type ReceiptPrintPlatform = 'android' | 'ios' | 'desktop';

export function detectReceiptPrintPlatform(): ReceiptPrintPlatform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'android';
  if (/iPad|iPhone|iPod/i.test(ua)) return 'ios';
  // iPadOS 13+ often reports as Macintosh with touch.
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return 'ios';
  return 'desktop';
}

export function isTabletOrPhone(): boolean {
  return detectReceiptPrintPlatform() !== 'desktop';
}
