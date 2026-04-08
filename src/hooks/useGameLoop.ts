import { useEffect, useRef } from 'react';
import { createGameLoop } from '../core/GameLoop';
import type { GameLoopHandle, GameTime } from '../types';

export interface UseGameLoopOptions {
  /** Target FPS (default: 60) */
  fps?: number;
  /** Whether the loop should run (default: true) */
  running?: boolean;
  onUpdate: (time: GameTime) => void;
}

/**
 * React hook that manages a game loop lifecycle.
 * Starts/stops automatically with the component and `running` flag.
 */
export function useGameLoop(options: UseGameLoopOptions): GameLoopHandle {
  const { fps = 60, running = true, onUpdate } = options;

  // Keep callbacks stable without forcing re-creation of the loop
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const handleRef = useRef<GameLoopHandle | null>(null);

  useEffect(() => {
    const handle = createGameLoop({
      fps,
      autoStart: running,
      onUpdate: (time) => onUpdateRef.current(time),
    });
    handleRef.current = handle;

    return () => {
      handle.stop();
      handleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fps]);

  // Respond to running flag changes without recreating the loop
  useEffect(() => {
    if (!handleRef.current) return;
    if (running) {
      handleRef.current.start();
    } else {
      handleRef.current.stop();
    }
  }, [running]);

  return {
    start: () => handleRef.current?.start(),
    stop: () => handleRef.current?.stop(),
    isRunning: () => handleRef.current?.isRunning() ?? false,
  };
}
