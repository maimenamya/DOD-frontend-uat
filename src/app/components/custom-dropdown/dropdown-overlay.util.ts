/** Global mount point for portaled dropdown menus (outside app-root / overflow:hidden). */
export function getDropdownOverlayRoot(): HTMLElement {
  const existing = document.getElementById('app-dropdown-overlay-root');
  if (existing) {
    return existing;
  }

  const root = document.createElement('div');
  root.id = 'app-dropdown-overlay-root';
  root.className = 'app-dropdown-overlay-root';
  root.setAttribute('aria-hidden', 'true');
  document.body.appendChild(root);
  return root;
}
