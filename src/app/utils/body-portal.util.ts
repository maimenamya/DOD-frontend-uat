/** Body class while a portaled modal is open (scroll lock). */
export const APP_MODAL_BODY_LOCK_CLASS = 'app-modal-open';

/** Body class while open-table mobile sheet is open. */
export const OPEN_TABLE_MOBILE_SHEET_BODY_LOCK_CLASS = 'open-table-mobile-sheet-open';

/** Move an element to `document.body` so `position:fixed` overlays cover the app header. */
export function portalElementToBody(element: HTMLElement): () => void {
  const parent = element.parentNode;
  if (!parent) {
    return () => {};
  }
  const placeholder = document.createComment('app-body-portal');
  parent.insertBefore(placeholder, element);
  document.body.appendChild(element);
  return () => {
    if (placeholder.parentNode) {
      placeholder.parentNode.insertBefore(element, placeholder);
      placeholder.remove();
    } else if (element.parentNode === document.body) {
      element.remove();
    }
  };
}
