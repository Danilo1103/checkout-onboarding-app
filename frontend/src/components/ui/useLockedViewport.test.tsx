import { render } from '@testing-library/react';
import { useRef } from 'react';
import { useLockedViewport } from './useLockedViewport';

function Overlay() {
  const ref = useRef<HTMLDivElement>(null);
  useLockedViewport(ref);
  return (
    <div ref={ref} data-testid="overlay">
      <input aria-label="field" />
    </div>
  );
}

describe('useLockedViewport', () => {
  afterEach(() => {
    Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true });
  });

  it('fixes the page behind the overlay and restores scroll when closing', () => {
    window.scrollTo = jest.fn();
    Object.defineProperty(window, 'scrollY', { value: 240, configurable: true });
    const { unmount } = render(<Overlay />);

    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe('-240px');
    expect(document.body.style.overflow).toBe('hidden');

    unmount();
    expect(document.body.style.position).toBe('');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 240);
  });

  it('follows the visual viewport so the footer stays above the keyboard', () => {
    const listeners: Record<string, () => void> = {};
    const viewport = {
      height: 667,
      offsetTop: 0,
      addEventListener: jest.fn((type: string, fn: () => void) => (listeners[type] = fn)),
      removeEventListener: jest.fn(),
    };
    Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true });
    const { getByTestId, unmount } = render(<Overlay />);
    const overlay = getByTestId('overlay');
    expect(overlay.style.getPropertyValue('--vv-height')).toBe('667px');

    viewport.height = 360;
    viewport.offsetTop = 40;
    listeners.resize();
    expect(overlay.style.getPropertyValue('--vv-height')).toBe('360px');
    expect(overlay.style.getPropertyValue('--vv-top')).toBe('40px');

    unmount();
    expect(viewport.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('centers the focused field when it gains focus and after the keyboard opens', () => {
    jest.useFakeTimers();
    const scrollIntoView = jest.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const listeners: Record<string, () => void> = {};
    Object.defineProperty(window, 'visualViewport', {
      value: { height: 667, offsetTop: 0, addEventListener: (t: string, fn: () => void) => (listeners[t] = fn), removeEventListener: jest.fn() },
      configurable: true,
    });
    const { getByLabelText, unmount } = render(<Overlay />);

    getByLabelText('field').focus();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });
    jest.advanceTimersByTime(350);
    listeners.resize();
    expect(scrollIntoView).toHaveBeenCalledTimes(3);

    unmount();
    jest.useRealTimers();
  });
});
