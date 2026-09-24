import { useEffect, type RefObject } from 'react';

/**
 * Keeps an overlay usable on mobile browsers:
 * - locks the page behind it (iOS ignores `overflow: hidden` on body, so the body is fixed in place);
 * - sizes the overlay to the visual viewport, so a footer stays above the on-screen keyboard;
 * - keeps the focused field centered in view, since the locked page can no longer scroll to it.
 */
export const useLockedViewport = (ref: RefObject<HTMLElement | null>): void => {
  useEffect(() => {
    const { body } = document;
    const scrollY = window.scrollY;
    const previous = { position: body.style.position, top: body.style.top, width: body.style.width, overflow: body.style.overflow };
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';

    const revealFocusedField = () => {
      const active = document.activeElement;
      if (active instanceof HTMLInputElement && ref.current?.contains(active)) {
        active.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      }
    };

    const viewport = window.visualViewport;
    const sync = () => {
      const element = ref.current;
      if (!element || !viewport) return;
      element.style.setProperty('--vv-height', `${viewport.height}px`);
      element.style.setProperty('--vv-top', `${viewport.offsetTop}px`);
      revealFocusedField();
    };
    sync();
    viewport?.addEventListener('resize', sync);
    viewport?.addEventListener('scroll', sync);

    // The keyboard opens after focus; reveal the field again once it has settled.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onFocusIn = () => {
      revealFocusedField();
      clearTimeout(timer);
      timer = setTimeout(revealFocusedField, 350);
    };
    const element = ref.current;
    element?.addEventListener('focusin', onFocusIn);

    return () => {
      clearTimeout(timer);
      element?.removeEventListener('focusin', onFocusIn);
      viewport?.removeEventListener('resize', sync);
      viewport?.removeEventListener('scroll', sync);
      Object.assign(body.style, previous);
      window.scrollTo(0, scrollY);
    };
  }, [ref]);
};
