import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared modal accessibility behavior: Escape-to-close, Tab focus trapped
 * inside the dialog, and focus returned to whatever triggered the modal
 * once it closes. Attach the returned ref to the modal's outer dialog div.
 */
export function useModalA11y<T extends HTMLElement = HTMLDivElement>(
  onClose: () => void,
  options?: { initialFocusSelector?: string },
) {
  const dialogRef = useRef<T>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;

    const preferred = options?.initialFocusSelector
      ? dialog?.querySelector<HTMLElement>(options.initialFocusSelector)
      : null;
    const focusables = dialog?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    (preferred ?? focusables?.[0] ?? dialog)?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialog) return;

      const nodes = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
    // options.initialFocusSelector is intentionally excluded — call sites
    // pass a fresh object literal each render, so including it would re-run
    // this effect (and re-steal focus) on every render. It's a static value
    // per modal type and never actually changes across a modal's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  return dialogRef;
}
