import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { createGameLoop } from '../core/GameLoop';
import { SensorBridge } from '../input/SensorBridge';
import { createTouchHandler } from '../input/TouchHandler';
import { SceneManager } from '../scenes/SceneManager';
import { GameEngineContext } from '../hooks/useGameEngine';
import type {
  AccelerometerData,
  Entities,
  GameEvent,
  GameTime,
  GyroscopeData,
  System,
  TouchEvent,
  GameEngineProps,
} from '../types';

const DEFAULT_TIME: GameTime = {
  current: 0,
  delta: 0,
  deltaSeconds: 0,
  fps: 0,
};

export function GameEngine({
  systems = [],
  entities: initialEntities = {},
  running = true,
  onEvent,
  onUpdate,
  physics,
  inputs = ['touch'],
  scenes,
  activeScene: initialScene,
  style,
  children,
}: GameEngineProps) {
  // ─── State refs (mutable, avoids stale closures in the game loop) ──────────
  const entitiesRef = useRef<Entities>(
    typeof initialEntities === 'function' ? initialEntities() : { ...initialEntities }
  );
  const systemsRef = useRef<System[]>(systems);
  const runningRef = useRef(running);
  const pendingTouches = useRef<TouchEvent[]>([]);
  const pendingEvents = useRef<GameEvent[]>([]);
  const accelRef = useRef<AccelerometerData | null>(null);
  const gyroRef = useRef<GyroscopeData | null>(null);
  const timeRef = useRef<GameTime>(DEFAULT_TIME);

  // Keep refs in sync with props
  systemsRef.current = systems;
  runningRef.current = running;

  // ─── Re-render trigger ─────────────────────────────────────────────────────
  const [, forceRender] = useState(0);

  // ─── Scene Manager ─────────────────────────────────────────────────────────
  const sceneManager = useMemo(
    () => (scenes ? new SceneManager(scenes, initialScene) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    if (sceneManager && initialScene) {
      sceneManager.transitionTo(initialScene);
      entitiesRef.current = sceneManager.getEntities();
      systemsRef.current = sceneManager.getSystems();
    }
  }, [sceneManager, initialScene]);

  // ─── Dispatch ─────────────────────────────────────────────────────────────
  const dispatch = useCallback((event: GameEvent) => {
    pendingEvents.current.push(event);
    onEvent?.(event);
  }, [onEvent]);

  // ─── Physics system injection ──────────────────────────────────────────────
  useEffect(() => {
    if (!physics) return;

    let physicsSystem: System | null = null;

    if (physics === 'arcade') {
      const { createArcadePhysicsSystem } = require('../physics/PhysicsBridge');
      physicsSystem = createArcadePhysicsSystem({
        onCollision: (a: string | number, b: string | number) => {
          dispatch({ type: 'collision', payload: { a, b } });
        },
      });
    } else if (physics === 'matter') {
      const { createMatterPhysicsSystem } = require('../physics/PhysicsBridge');
      physicsSystem = createMatterPhysicsSystem();
    }

    if (physicsSystem) {
      // Prepend physics system so it runs before user systems
      systemsRef.current = [physicsSystem, ...systemsRef.current];
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [physics]);

  // ─── Sensors ──────────────────────────────────────────────────────────────
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

  // ─── Game Loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const loop = createGameLoop({
      fps: 60,
      autoStart: running,
      onUpdate: (time: GameTime) => {
        if (!runningRef.current) return;

        timeRef.current = time;

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

        // Run all systems in order
        let current = entitiesRef.current;
        for (const system of systemsRef.current) {
          current = system(current, context);
        }
        entitiesRef.current = current;

        onUpdate?.(current, time);

        // Trigger React render
        forceRender((n) => n + 1);
      },
    });

    return () => loop.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start/stop in response to `running` prop changes
  useEffect(() => {
    // The loop effect already handles initial start; future changes handled by runningRef
    runningRef.current = running;
  }, [running]);

  // ─── Touch Input ──────────────────────────────────────────────────────────
  const panResponder = useMemo(() => {
    if (!inputs.includes('touch')) return null;

    return createTouchHandler({
      onTouch: (event) => {
        pendingTouches.current.push(event);
      },
    });
  }, [inputs]);

  // ─── Context value ─────────────────────────────────────────────────────────
  const contextValue = useMemo(
    () => ({
      entities: entitiesRef.current,
      dispatch,
      time: timeRef.current,
      running: runningRef.current,
      stop: () => { runningRef.current = false; },
      start: () => { runningRef.current = true; },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatch]
  );

  return (
    <GameEngineContext.Provider value={contextValue}>
      <View
        style={[styles.container, style]}
        {...(panResponder?.panHandlers ?? {})}
      >
        {children}
      </View>
    </GameEngineContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
