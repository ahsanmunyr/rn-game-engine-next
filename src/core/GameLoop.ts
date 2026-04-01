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
  const { fps = 60, autoStart = true, onUpdate } = options;
  const frameInterval = 1000 / fps;

  let rafId: ReturnType<typeof requestAnimationFrame> | null = null;
  let running = false;
  let lastTimestamp = 0;
  let startTime = 0;

  // FPS smoothing ring buffer
  const deltaSamples: number[] = [];

  function calculateFps(delta: number): number {
    deltaSamples.push(delta);
    if (deltaSamples.length > FPS_SAMPLE_SIZE) {
      deltaSamples.shift();
    }
    const avg = deltaSamples.reduce((a, b) => a + b, 0) / deltaSamples.length;
    return avg > 0 ? Math.round(1000 / avg) : 0;
  }

  function loop(timestamp: number) {
    if (!running) return;

    if (lastTimestamp === 0) {
      lastTimestamp = timestamp;
      startTime = timestamp;
    }

    const delta = timestamp - lastTimestamp;

    if (delta >= frameInterval) {
      lastTimestamp = timestamp - (delta % frameInterval);

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
