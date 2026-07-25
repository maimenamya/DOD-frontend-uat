/** Canonical shop login query — path must stay `/login` (not `/s/…/login`) for iOS PWA scope. */
export function shopLoginQueryParams(
  shopPublicId: string,
  extra?: Record<string, string | undefined | null>,
): Record<string, string> {
  const query: Record<string, string> = { shop: shopPublicId };
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value != null && value !== '') query[key] = value;
    }
  }
  return query;
}
