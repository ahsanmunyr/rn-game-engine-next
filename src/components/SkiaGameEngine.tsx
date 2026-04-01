import { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { SensorBridge } from '../input/SensorBridge';
import { createTouchHandler } from '../input/TouchHandler';
import { GameEngineContext } from '../hooks/useGameEngine';
import type {
  AccelerometerData,
  Entities,
  GameEngineProps,
  GameEvent,
  GameTime,
  GyroscopeData,
  SkiaRenderer,
  System,
  TouchEvent,
} from '../types';

// ─── Lazy peer-dep resolution ─────────────────────────────────────────────────
// @shopify/react-native-skia and react-native-reanimated are optional peer
// deps. We resolve them at module load time so hook call-order is stable.

let _Canvas: any;
let _Picture: any;
let _Skia: any;
let _useSharedValue: any;
let _useDerivedValue: any;
let _peerError: string | null = null;

try {
  const skia = require('@shopify/react-native-skia');
  _Canvas = skia.Canvas;
  _Picture = skia.Picture;
  _Skia = skia.Skia;
} catch {
  _peerError =
    '[rn-game-engine-next] SkiaGameEngine requires @shopify/react-native-skia. ' +
    'Run: yarn add @shopify/react-native-skia && cd ios && pod install';
}

try {
  const reanimated = require('react-native-reanimated');
  _useSharedValue = reanimated.useSharedValue;
  _useDerivedValue = reanimated.useDerivedValue;
} catch {
  _peerError =
    '[rn-game-engine-next] SkiaGameEngine requires react-native-reanimated. ' +
    'Run: yarn add react-native-reanimated && cd ios && pod install';
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SkiaGameEngine({
  systems = [],
  entities: initialEntities = {},
  running = true,
  onEvent,
  onUpdate,
  inputs = ['touch'],
  style,
}: GameEngineProps) {
  if (_peerError) throw new Error(_peerError);

  // ─── Mutable refs (stable across renders, no stale-closure issues) ─────────
  const entitiesRef = useRef<Entities>(
    typeof initialEntities === 'function'
      ? initialEntities()
      : { ...initialEntities }
  );
  const systemsRef = useRef<System[]>(systems);
  const runningRef = useRef(running);
  const pendingTouches = useRef<TouchEvent[]>([]);
  const pendingEvents = useRef<GameEvent[]>([]);
  const accelRef = useRef<AccelerometerData | null>(null);
  const gyroRef = useRef<GyroscopeData | null>(null);

  systemsRef.current = systems;
  runningRef.current = running;

  // ─── Shared value — drives Skia canvas without setState ────────────────────
  // Updating `.value` bypasses React's reconciler entirely; the UI thread reads
  // it directly via the worklet draw callback below.
  const entitiesShared = _useSharedValue(entitiesRef.current);

  // ─── Dispatch ──────────────────────────────────────────────────────────────
  const dispatch = useCallback(
    (event: GameEvent) => {
      pendingEvents.current.push(event);
      onEvent?.(event);
    },
    [onEvent]
  );

  // ─── Sensors ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const sensors = new SensorBridge();
    if (inputs.includes('accelerometer')) {
      sensors.startAccelerometer(16, (data) => {
        accelRef.current = data;
      });
    }
    if (inputs.includes('gyroscope')) {
      sensors.startGyroscope(16, (data) => {
        gyroRef.current = data;
      });
    }
    return () => sensors.stopAll();
  }, [inputs]);

  // ─── Game loop — JS thread via requestAnimationFrame ────────────────────────
  // Systems are plain JS functions and must run on the JS thread.
  // entitiesShared.value is updated here; Skia reads it on the UI thread.
  const startTimeRef = useRef(0);
  const lastTimestampRef = useRef(0);
  const deltaSamplesRef = useRef<number[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const loop = (timestamp: number) => {
      if (runningRef.current) {
        if (lastTimestampRef.current === 0) {
          lastTimestampRef.current = timestamp;
          startTimeRef.current = timestamp;
        } else {
          const delta = timestamp - lastTimestampRef.current;
          lastTimestampRef.current = timestamp;

          const samples = deltaSamplesRef.current;
          samples.push(delta);
          if (samples.length > 30) samples.shift();
          const avg =
            samples.reduce((a: number, b: number) => a + b, 0) / samples.length;
          const fps = avg > 0 ? Math.round(1000 / avg) : 0;

          const time: GameTime = {
            current: timestamp - startTimeRef.current,
            delta,
            deltaSeconds: delta / 1000,
            fps,
          };

          const touches = pendingTouches.current.splice(0);
          const events = pendingEvents.current.splice(0);

          const context = {
            time,
            touches,
            events,
            dispatch,
            accelerometer: accelRef.current,
            gyroscope: gyroRef.current,
          };

          let current = entitiesRef.current;
          for (const system of systemsRef.current) {
            current = system(current, context);
          }
          entitiesRef.current = current;
          entitiesShared.value = current;

          onUpdate?.(current, time);
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Touch input ──────────────────────────────────────────────────────────
  const panResponder = useMemo(() => {
    if (!inputs.includes('touch')) return null;
    return createTouchHandler({
      onTouch: (event) => {
        pendingTouches.current.push(event);
      },
    });
  }, [inputs]);

  // ─── Skia draw — runs on the UI thread via Reanimated useDerivedValue ───────
  // Skia v2 removed useDrawCallback/onDraw. We use PictureRecorder to record
  // draw commands into an SkPicture derived value, then render it via <Picture>.
  const skia = _Skia; // capture for worklet closure
  const picture = _useDerivedValue(() => {
    'worklet';
    const recorder = skia.PictureRecorder();
    const canvas = recorder.beginRecording(skia.XYWHRect(0, 0, 9999, 9999));

    const entityMap = entitiesShared.value;
    const keys = Object.keys(entityMap);

    for (let i = 0; i < keys.length; i++) {
      const entity = entityMap[keys[i] as keyof typeof entityMap] as any;
      const renderer: SkiaRenderer | undefined = entity.renderer;
      if (!renderer) continue;

      const paint = skia.Paint();
      paint.setColor(skia.Color(renderer.color ?? '#ffffff'));
      if (renderer.opacity !== undefined) {
        paint.setAlphaf(renderer.opacity);
      }
      paint.setAntiAlias(true);

      const x: number = entity.x ?? 0;
      const y: number = entity.y ?? 0;

      if (renderer.type === 'circle') {
        canvas.drawCircle(x, y, renderer.radius ?? 10, paint);
      } else if (renderer.type === 'rect') {
        const w = renderer.width ?? 50;
        const h = renderer.height ?? 50;
        canvas.drawRect(skia.XYWHRect(x - w / 2, y - h / 2, w, h), paint);
      }
    }

    return recorder.finishRecordingAsPicture();
  });

  // ─── Context ───────────────────────────────────────────────────────────────
  const contextValue = useMemo(
    () => ({
      entities: entitiesRef.current,
      dispatch,
      time: { current: 0, delta: 0, deltaSeconds: 0, fps: 0 },
      running: runningRef.current,
      stop: () => {
        runningRef.current = false;
      },
      start: () => {
        runningRef.current = true;
      },
    }),
    [dispatch]
  );

  return (
    <GameEngineContext.Provider value={contextValue}>
      <_Canvas
        style={[styles.container, style]}
        {...(panResponder?.panHandlers ?? {})}
      >
        <_Picture picture={picture} />
      </_Canvas>
    </GameEngineContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
