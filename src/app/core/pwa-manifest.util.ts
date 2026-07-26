/** Point the document manifest at a shop-scoped start_url for Add to Home Screen. */
export function syncPwaManifestLink(shopPublicId: string | null | undefined): void {
  if (typeof document === 'undefined') return;
  const trimmed = shopPublicId?.trim() ?? '';
  const href =
    trimmed && /^[a-zA-Z0-9_-]{1,64}$/.test(trimmed)
      ? `/api/manifest?shop=${encodeURIComponent(trimmed)}`
      : '/manifest.webmanifest';

  const links = document.querySelectorAll('link[rel="manifest"]');
  if (!links.length) {
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.type = 'application/manifest+json';
    link.href = href;
    document.head.appendChild(link);
    return;
  }
  for (const link of Array.from(links)) {
    if (link.getAttribute('href') !== href) {
      link.setAttribute('href', href);
    }
  }
}
