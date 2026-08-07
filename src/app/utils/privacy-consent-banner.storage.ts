const STORAGE_PREFIX = 'dod_privacy_consent_banner_dismissed';

function storageKey(organizationId: number, policyVersion: string): string {
  return `${STORAGE_PREFIX}:${organizationId}:${policyVersion}`;
}

/** Dismiss for this browser tab/session only — reappears after login/new session. */
export function isPrivacyConsentBannerDismissed(
  organizationId: number,
  policyVersion: string,
): boolean {
  try {
    return sessionStorage.getItem(storageKey(organizationId, policyVersion)) === '1';
  } catch {
    return false;
  }
}

export function dismissPrivacyConsentBanner(
  organizationId: number,
  policyVersion: string,
): void {
  try {
    sessionStorage.setItem(storageKey(organizationId, policyVersion), '1');
  } catch {
    /* ignore quota / private mode */
  }
}

/** Call on logout / new login so the banner can show again. */
export function clearPrivacyConsentBannerDismissals(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) keys.push(key);
    }
    for (const key of keys) sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
