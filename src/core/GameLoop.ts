import type { GameLoopHandle, GameLoopOptions, GameTime } from '../types';

const FPS_SAMPLE_SIZE = 30;

/**
 * RAF-based game loop. Runs on the JS thread.
 *
 * When react-native-reanimated is available and the consumer wraps the loop
 * in a worklet, the onUpdate callback can run on the UI thread instead —
 * just call `GameLoop.createWorkletLoop()` in that scenario.
 */
export function createGameLoop(options: GameLoopOptions): GameLoopHandle {
  const { fps, autoStart = true, onUpdate } = options;
  // 0 = no cap (run every RAF tick — let the display drive the rate)
  const frameInterval = fps ? 1000 / fps : 0;

  let rafId: ReturnType<typeof requestAnimationFrame> | null = null;
  let running = false;
  let lastTimestamp = 0;
  let startTime = 0;

  // FPS smoothing ring buffer with O(1) rolling sum (no reduce per frame)
  const deltaSamples: number[] = [];
  let deltaSum = 0;

  function calculateFps(delta: number): number {
    // Clamp to 1ms minimum so a delta of 0 (theoretically impossible on RAF but
    // possible in tests) never causes division by zero or a bogus 0 fps reading.
    const clamped = Math.max(delta, 1);
    deltaSamples.push(clamped);
    deltaSum += clamped;
    if (deltaSamples.length > FPS_SAMPLE_SIZE) {
      deltaSum -= deltaSamples.shift()!;
    }
    return Math.round(1000 / (deltaSum / deltaSamples.length));
  }

  function loop(timestamp: number) {
    if (!running) return;

    if (lastTimestamp === 0) {
      lastTimestamp = timestamp;
      startTime = timestamp;
    }

    const delta = timestamp - lastTimestamp;

    // When a cap is set, add 20% tolerance to avoid jitter-induced frame skips
    // on Android's Choreographer (which delivers timestamps ~0.5–2 ms early).
    // Without tolerance, a 16.5 ms delta against a 16.67 ms target is skipped,
    // the next fires at ~25 ms, and the loop settles at ~40 fps instead of 60.
    const shouldTick =
      frameInterval === 0 || delta >= frameInterval * 0.8;

    if (shouldTick) {
      lastTimestamp =
        frameInterval > 0
          ? timestamp - (delta % frameInterval)
          : timestamp;

      const time: GameTime = {
        current: timestamp - startTime,
        delta,
        deltaSeconds: delta / 1000,
        fps: calculateFps(delta),
      };

      onUpdate(time);
    }

    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (running) return;
    running = true;
    lastTimestamp = 0;
    deltaSamples.length = 0;
    deltaSum = 0;
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  if (autoStart) {
    start();
  }

  return { start, stop, isRunning: () => running };
}
