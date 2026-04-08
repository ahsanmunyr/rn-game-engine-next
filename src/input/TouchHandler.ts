import {
  PanResponder,
  type GestureResponderEvent,
  type PanResponderInstance,
} from 'react-native';
import type { TouchEvent, TouchPoint } from '../types';

const LONG_PRESS_DURATION = 400; // ms

type TouchCallback = (event: TouchEvent) => void;

interface TouchHandlerOptions {
  onTouch: TouchCallback;
}

function extractPoints(e: GestureResponderEvent): TouchPoint[] {
  const touches = e.nativeEvent.touches ?? [];
  return touches.map((t) => ({
    id: t.identifier,
    x: t.pageX,
    y: t.pageY,
    timestamp: Date.now(),
  }));
}

function extractChangedPoints(e: GestureResponderEvent): TouchPoint[] {
  const changed = e.nativeEvent.changedTouches ?? [];
  return changed.map((t) => ({
    id: t.identifier,
    x: t.pageX,
    y: t.pageY,
    timestamp: Date.now(),
  }));
}

export function createTouchHandler(
  options: TouchHandlerOptions
): PanResponderInstance {
  const { onTouch } = options;

  const longPressTimers = new Map<number, ReturnType<typeof setTimeout>>();

  function clearLongPress(id: number) {
    const timer = longPressTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      longPressTimers.delete(id);
    }
  }

  return PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponderCapture: () => false,

    onPanResponderGrant: (e) => {
      const changed = extractChangedPoints(e);
      const all = extractPoints(e);
      const now = Date.now();

      changed.forEach((t) => {
        const timer = setTimeout(() => {
          onTouch({
            type: 'long-press',
            touches: all,
            changedTouches: [t],
            timestamp: Date.now(),
          });
          longPressTimers.delete(t.id);
        }, LONG_PRESS_DURATION);
        longPressTimers.set(t.id, timer);
      });

      onTouch({
        type: 'start',
        touches: all,
        changedTouches: changed,
        timestamp: now,
      });
    },

    onPanResponderMove: (e) => {
      const changed = extractChangedPoints(e);
      // Cancel long press if finger moved significantly
      changed.forEach((t) => clearLongPress(t.id));

      onTouch({
        type: 'move',
        touches: extractPoints(e),
        changedTouches: changed,
        timestamp: Date.now(),
      });
    },

    onPanResponderRelease: (e) => {
      const changed = extractChangedPoints(e);
      const now = Date.now();

      changed.forEach((t) => clearLongPress(t.id));

      onTouch({
        type: 'end',
        touches: extractPoints(e),
        changedTouches: changed,
        timestamp: now,
      });

      // Fire 'press' for each released touch
      changed.forEach((t) => {
        onTouch({
          type: 'press',
          touches: extractPoints(e),
          changedTouches: [t],
          timestamp: now,
        });
      });
    },

    onPanResponderTerminate: (e) => {
      const changed = extractChangedPoints(e);
      changed.forEach((t) => clearLongPress(t.id));

      onTouch({
        type: 'end',
        touches: extractPoints(e),
        changedTouches: changed,
        timestamp: Date.now(),
      });
    },
  });
}
