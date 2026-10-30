import { useCallback, useEffect, useRef, useState } from 'react';

export interface SwipeDividerOptions {
  /** Container the divider is positioned within. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Initial position as a fraction of the container's width, `0..1`. */
  defaultPosition?: number;
  /** Controlled position as a fraction, `0..1`. */
  position?: number;
  onPositionChange?: (position: number) => void;
  /** Keyboard step, as a fraction of the container's width. Default `0.02`. */
  step?: number;
  /** Split direction. Default `'vertical'` — a divider that moves left/right. */
  orientation?: 'vertical' | 'horizontal';
}

export interface SwipeDividerState {
  /** Current position as a fraction of the container, `0..1`. */
  position: number;
  /** `true` while a pointer is dragging the handle. */
  dragging: boolean;
  /** Props to spread onto the handle element. */
  handleProps: {
    role: 'separator';
    tabIndex: 0;
    'aria-orientation': 'vertical' | 'horizontal';
    'aria-valuenow': number;
    'aria-valuemin': 0;
    'aria-valuemax': 100;
    'aria-label': string;
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
  };
}

/**
 * Drag and keyboard behaviour for a comparison divider.
 *
 * Three details separate this from a bare mousemove listener:
 *
 * **Pointer events with capture.** A single `pointerdown`/`pointermove` pair
 * covers mouse, touch and pen, and `setPointerCapture` keeps the drag alive when
 * the pointer leaves the handle — without it a fast drag detaches the moment the
 * cursor outruns the element, which is the usual reason a swipe control feels
 * unreliable.
 *
 * **A fraction, not a pixel offset.** Storing the position relative to the
 * container means a resize preserves what the reader was looking at, rather than
 * leaving the divider stranded at a pixel offset that no longer corresponds to
 * anything.
 *
 * **Keyboard operability.** The handle is a `separator` in the accessibility
 * tree and responds to the arrow keys, so the comparison is reachable without a
 * pointer. A swipe control that only works by dragging is inaccessible to
 * keyboard and switch users, and a comparison map is often the only place a
 * particular fact is presented.
 */
export function useSwipeDivider(
  options: SwipeDividerOptions,
): SwipeDividerState {
  const {
    containerRef,
    defaultPosition = 0.5,
    position: controlled,
    onPositionChange,
    step = 0.02,
    orientation = 'vertical',
  } = options;

  const [uncontrolled, setUncontrolled] = useState(clamp(defaultPosition));
  const [dragging, setDragging] = useState(false);

  const position = controlled != null ? clamp(controlled) : uncontrolled;

  const onChange = useRef(onPositionChange);
  onChange.current = onPositionChange;
  const isControlled = controlled != null;

  const commit = useCallback(
    (next: number) => {
      const value = clamp(next);
      if (!isControlled) setUncontrolled(value);
      onChange.current?.(value);
    },
    [isControlled],
  );

  const fromClient = useCallback(
    (clientX: number, clientY: number): number | null => {
      const element = containerRef.current;
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      if (orientation === 'horizontal') {
        return rect.height > 0 ? (clientY - rect.top) / rect.height : null;
      }
      return rect.width > 0 ? (clientX - rect.left) / rect.width : null;
    },
    [containerRef, orientation],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);

      const target = event.currentTarget;
      const move = (moveEvent: PointerEvent) => {
        const next = fromClient(moveEvent.clientX, moveEvent.clientY);
        if (next != null) commit(next);
      };
      const stop = (upEvent: PointerEvent) => {
        setDragging(false);
        target.releasePointerCapture?.(upEvent.pointerId);
        target.removeEventListener('pointermove', move);
        target.removeEventListener('pointerup', stop);
        target.removeEventListener('pointercancel', stop);
      };

      target.addEventListener('pointermove', move);
      target.addEventListener('pointerup', stop);
      target.addEventListener('pointercancel', stop);
    },
    [commit, fromClient],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      const decrease = orientation === 'horizontal' ? 'ArrowUp' : 'ArrowLeft';
      const increase = orientation === 'horizontal' ? 'ArrowDown' : 'ArrowRight';

      switch (event.key) {
        case decrease:
          commit(position - step);
          break;
        case increase:
          commit(position + step);
          break;
        case 'Home':
          commit(0);
          break;
        case 'End':
          commit(1);
          break;
        case 'Enter':
        case ' ':
          commit(0.5);
          break;
        default:
          return;
      }
      event.preventDefault();
    },
    [commit, orientation, position, step],
  );

  // Releasing the pointer outside the document (a drag ended in another window)
  // would otherwise leave the handle stuck in its dragging state.
  useEffect(() => {
    if (!dragging) return;
    const stop = () => setDragging(false);
    window.addEventListener('blur', stop);
    return () => window.removeEventListener('blur', stop);
  }, [dragging]);

  return {
    position,
    dragging,
    handleProps: {
      role: 'separator',
      tabIndex: 0,
      'aria-orientation': orientation,
      'aria-valuenow': Math.round(position * 100),
      'aria-valuemin': 0,
      'aria-valuemax': 100,
      'aria-label': 'Comparison divider',
      onPointerDown,
      onKeyDown,
    },
  };
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));
