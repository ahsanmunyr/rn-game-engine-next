// ─── Main Components ──────────────────────────────────────────────────────────
export { GameEngine } from './components/GameEngine';
// Requires @shopify/react-native-skia + react-native-reanimated peer deps
export { SkiaGameEngine } from './components/SkiaGameEngine';

// ─── Hooks ────────────────────────────────────────────────────────────────────
export { useGameLoop } from './hooks/useGameLoop';
export { useEntities } from './hooks/useEntities';
export { useGameEngine, GameEngineContext } from './hooks/useGameEngine';

// ─── Core ─────────────────────────────────────────────────────────────────────
export { createGameLoop } from './core/GameLoop';
export { EventEmitter } from './core/EventEmitter';
export {
  generateEntityId,
  addEntity,
  removeEntity,
  updateEntity,
  queryEntities,
  getEntity,
  entitiesToMap,
  cloneEntities,
} from './core/EntityManager';

// ─── Scene Manager ────────────────────────────────────────────────────────────
export { SceneManager } from './scenes/SceneManager';

// ─── Physics ──────────────────────────────────────────────────────────────────
export {
  createArcadePhysicsSystem,
  createMatterPhysicsSystem,
} from './physics/PhysicsBridge';

// ─── Haptics ──────────────────────────────────────────────────────────────────
export { HapticManager } from './haptics/HapticManager';

// ─── Sensor Bridge ────────────────────────────────────────────────────────────
export { SensorBridge } from './input/SensorBridge';

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  Entity,
  Entities,
  EntityId,
  GameTime,
  GameEvent,
  System,
  SystemContext,
  TouchEvent,
  TouchEventType,
  TouchPoint,
  AccelerometerData,
  GyroscopeData,
  PhysicsEngine,
  SceneDefinition,
  SceneMap,
  InputSource,
  HapticType,
  GameEngineProps,
  GameLoopOptions,
  GameLoopHandle,
  SkiaRenderer,
  SkiaRendererType,
} from './types';
