// ─── Core Types ──────────────────────────────────────────────────────────────

export type EntityId = string | number;

export interface Entity {
  id: EntityId;
  [key: string]: unknown;
}

export type Entities = Record<EntityId, Entity>;

// ─── Time ────────────────────────────────────────────────────────────────────

export interface GameTime {
  /** Total elapsed time in ms since the engine started */
  current: number;
  /** Delta time in ms since the last frame */
  delta: number;
  /** Delta time in seconds (delta / 1000) */
  deltaSeconds: number;
  /** Frames per second (smoothed) */
  fps: number;
}

// ─── Touch ───────────────────────────────────────────────────────────────────

export type TouchEventType =
  | 'start'
  | 'end'
  | 'move'
  | 'press'
  | 'long-press';

export interface TouchPoint {
  id: number;
  x: number;
  y: number;
  timestamp: number;
}

export interface TouchEvent {
  type: TouchEventType;
  touches: TouchPoint[];
  changedTouches: TouchPoint[];
  timestamp: number;
}

// ─── Sensors ─────────────────────────────────────────────────────────────────

export interface AccelerometerData {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

export interface GyroscopeData {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

// ─── Game Events ─────────────────────────────────────────────────────────────

export interface GameEvent {
  type: string;
  payload?: unknown;
}

// ─── Systems ─────────────────────────────────────────────────────────────────

export interface SystemContext {
  time: GameTime;
  touches: TouchEvent[];
  events: GameEvent[];
  dispatch: (event: GameEvent) => void;
  accelerometer: AccelerometerData | null;
  gyroscope: GyroscopeData | null;
}

/**
 * A system receives entities + context, mutates/returns updated entities.
 * Return the same object for performance (mutations are fine), or a new one.
 */
export type System = (entities: Entities, context: SystemContext) => Entities;

// ─── Physics ─────────────────────────────────────────────────────────────────

export type PhysicsEngine = 'arcade' | 'matter';

// ─── Scenes ──────────────────────────────────────────────────────────────────

export interface SceneDefinition {
  systems: System[];
  entities: Entities | (() => Entities);
}

export type SceneMap = Record<string, SceneDefinition>;

// ─── Inputs ──────────────────────────────────────────────────────────────────

export type InputSource = 'touch' | 'accelerometer' | 'gyroscope';

// ─── Haptics ─────────────────────────────────────────────────────────────────

export type HapticType =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'success'
  | 'warning'
  | 'error';

// ─── Skia Renderer ───────────────────────────────────────────────────────────

export type SkiaRendererType = 'circle' | 'rect';

/**
 * Attach a `renderer` field to any entity to have SkiaGameEngine draw it.
 *
 * circle: uses `entity.x / entity.y` as centre point, `radius` for size.
 * rect:   uses `entity.x / entity.y` as centre point, `width / height` for size.
 */
export interface SkiaRenderer {
  type: SkiaRendererType;
  color?: string;
  opacity?: number;
  /** circle only */
  radius?: number;
  /** rect only */
  width?: number;
  height?: number;
}

// ─── GameEngine Props ─────────────────────────────────────────────────────────

export interface GameEngineProps {
  /** Systems run every frame in order */
  systems?: System[];
  /** Initial entities */
  entities?: Entities | (() => Entities);
  /** Whether the game loop is running */
  running?: boolean;
  /** Called when a game event is dispatched */
  onEvent?: (event: GameEvent) => void;
  /** Called every frame with current entities (for external state sync) */
  onUpdate?: (entities: Entities, time: GameTime) => void;
  /** Optional physics engine preset */
  physics?: PhysicsEngine;
  /** Input sources to enable */
  inputs?: InputSource[];
  /** Scene map + active scene */
  scenes?: SceneMap;
  activeScene?: string;
  /** Style passed to the container View */
  style?: object;
  children?: React.ReactNode;
}

// ─── Loop ────────────────────────────────────────────────────────────────────

export interface GameLoopOptions {
  /** Target FPS (default: 60) */
  fps?: number;
  /** Whether to start immediately (default: true) */
  autoStart?: boolean;
  onUpdate: (time: GameTime) => void;
}

export interface GameLoopHandle {
  start: () => void;
  stop: () => void;
  isRunning: () => boolean;
}
