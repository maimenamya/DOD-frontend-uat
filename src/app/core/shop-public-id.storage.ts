export const SHOP_PUBLIC_ID_STORAGE_KEY = 'dod_shop_public_id';

export function readStoredShopPublicId(): string | null {
  try {
    const raw = localStorage.getItem(SHOP_PUBLIC_ID_STORAGE_KEY)?.trim();
    return raw || null;
  } catch {
    return null;
  }
}

export function writeStoredShopPublicId(publicId: string): void {
  const trimmed = publicId.trim();
  if (!trimmed) return;
  try {
    localStorage.setItem(SHOP_PUBLIC_ID_STORAGE_KEY, trimmed);
  } catch {
    // ignore quota / private mode
  }
}
