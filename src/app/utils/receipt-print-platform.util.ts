export type ReceiptPrintPlatform = 'android' | 'ios' | 'desktop';

export function detectReceiptPrintPlatform(): ReceiptPrintPlatform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'android';
  if (/iPad|iPhone|iPod/i.test(ua)) return 'ios';
  return 'desktop';
}

export function isTabletOrPhone(): boolean {
  return detectReceiptPrintPlatform() !== 'desktop';
}
