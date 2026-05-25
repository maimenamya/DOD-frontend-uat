const OVERLAY_ID = 'app-action-overlay';

let overlayEl: HTMLDivElement | null = null;

function ensureOverlay(): HTMLDivElement {
  if (overlayEl?.isConnected) {
    return overlayEl;
  }

  const existing = document.getElementById(OVERLAY_ID);
  if (existing instanceof HTMLDivElement) {
    overlayEl = existing;
    return overlayEl;
  }

  const root = document.createElement('div');
  root.id = OVERLAY_ID;
  root.className = 'app-action-overlay';
  root.setAttribute('aria-busy', 'true');
  root.setAttribute('aria-live', 'polite');
  root.hidden = true;

  const message = document.createElement('p');
  message.className = 'app-action-overlay-message';
  root.appendChild(message);

  document.body.appendChild(root);
  overlayEl = root;
  return root;
}

export function showActionOverlay(message: string): void {
  const root = ensureOverlay();
  const messageEl = root.querySelector('.app-action-overlay-message');
  if (messageEl) {
    messageEl.textContent = message;
  }
  root.hidden = false;
  document.body.classList.add('app-action-overlay-open');
}

export function hideActionOverlay(): void {
  if (overlayEl) {
    overlayEl.hidden = true;
  }
  document.body.classList.remove('app-action-overlay-open');
}
