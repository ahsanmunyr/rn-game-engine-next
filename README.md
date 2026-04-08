<p align="center">
  <img src="https://raw.githubusercontent.com/ahsanmunyr/rn-game-engine-next/main/logo.svg" alt="React Native Engine Next" width="280" />
</p>

<p align="center">
  <strong>A New Architecture React Native game engine</strong><br/>
  Zero required dependencies &nbsp;·&nbsp; Optional high-performance Skia renderer &nbsp;·&nbsp; 60–120 fps
</p>

<p align="center">
  <a href="#installation">Installation</a> ·
  <a href="#two-rendering-modes">Rendering Modes</a> ·
  <a href="#core-concepts">Core Concepts</a> ·
  <a href="#hooks">Hooks</a> ·
  <a href="#entity-manager">Entity Manager</a> ·
  <a href="#scene-manager">Scene Manager</a> ·
  <a href="#physics">Physics</a> ·
  <a href="#haptics">Haptics</a> ·
  <a href="#sensors">Sensors</a> ·
  <a href="#api-reference">API Reference</a> ·
  <a href="#performance--fps">Performance</a> ·
  <a href="#roadmap">Roadmap</a>
</p>

---

## Screenshots

<p align="center">
  <img src="https://raw.githubusercontent.com/ahsanmunyr/rn-game-engine-next/main/assets/Simulator%20Screenshot%20-%20iphone14%20-%202026-04-01%20at%2014.27.27.png" width="23%" alt="Boss fight" />
  &nbsp;
  <img src="https://raw.githubusercontent.com/ahsanmunyr/rn-game-engine-next/main/assets/Simulator%20Screenshot%20-%20iphone14%20-%202026-04-01%20at%2014.27.22.png" width="23%" alt="Wave Clear – power-up selection" />
  &nbsp;
  <img src="https://raw.githubusercontent.com/ahsanmunyr/rn-game-engine-next/main/assets/Simulator%20Screenshot%20-%20iphone14%20-%202026-04-01%20at%2014.28.12.png" width="23%" alt="Round 2 – spread shot upgrade" />
  &nbsp;
  <img src="https://raw.githubusercontent.com/ahsanmunyr/rn-game-engine-next/main/assets/Simulator%20Screenshot%20-%20iphone14%20-%202026-04-01%20at%2014.26.59.png" width="23%" alt="Game Over screen" />
</p>

<p align="center">
  <sub>Boss fight &nbsp;·&nbsp; Wave Clear power-up selection &nbsp;·&nbsp; Round 2 with upgrades &nbsp;·&nbsp; Game Over</sub>
</p>

---

## Installation

```sh
npm install rn-game-engine-next
# or
yarn add rn-game-engine-next
```

---

## Two Rendering Modes

| | `GameEngine` | `SkiaGameEngine` |
|---|---|---|
| Extra dependencies | None | `@shopify/react-native-skia` + `react-native-reanimated` |
| Game loop | JS thread (`requestAnimationFrame`) | JS thread (`requestAnimationFrame`) |
| Rendering | React `View` children (JS thread) | Skia canvas via Reanimated worklet (UI thread) |
| Typical FPS | ~30–40 fps | 60–120 fps |
| Entity rendering | React `View` children | `renderer` field on entity |
| Best for | Prototyping, simple games | Smooth / production games |

---

## GameEngine (Simple Mode)

No extra dependencies required. Entities are rendered as React `View` children. The game loop runs on the JS thread and calls `setState` each frame — great for prototyping but capped at ~33 fps on most devices.

### Usage

```tsx
import { useState } from 'react';
import { Dimensions, View } from 'react-native';
import { GameEngine, type Entities, type System } from 'rn-game-engine-next';

const BALL_SIZE = 20;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const BounceSystem: System = (entities, { time }) => {
  const ball = entities['ball'];
  if (!ball) return entities;

  let x = (ball.x as number) + (ball.vx as number) * time.deltaSeconds;
  let y = (ball.y as number) + (ball.vy as number) * time.deltaSeconds;
  let vx = ball.vx as number;
  let vy = ball.vy as number;

  if (x <= BALL_SIZE / 2)            { x = BALL_SIZE / 2;            vx =  Math.abs(vx); }
  if (x >= SCREEN_W - BALL_SIZE / 2) { x = SCREEN_W - BALL_SIZE / 2; vx = -Math.abs(vx); }
  if (y <= BALL_SIZE / 2)            { y = BALL_SIZE / 2;            vy =  Math.abs(vy); }
  if (y >= SCREEN_H - BALL_SIZE / 2) { y = SCREEN_H - BALL_SIZE / 2; vy = -Math.abs(vy); }

  return { ...entities, ball: { ...ball, x, y, vx, vy } };
};

const INITIAL_ENTITIES: Entities = {
  ball: { id: 'ball', x: SCREEN_W / 2, y: SCREEN_H / 2, vx: 120, vy: 90 },
};

export default function App() {
  const [entities, setEntities] = useState<Entities>(INITIAL_ENTITIES);

  return (
    <GameEngine
      style={{ flex: 1 }}
      systems={[BounceSystem]}
      entities={INITIAL_ENTITIES}
      running={true}
      onUpdate={(updatedEntities) => setEntities({ ...updatedEntities })}
    >
      {Object.values(entities).map((entity) => {
        const e = entity as { id: string; x: number; y: number };
        return (
          <View
            key={e.id}
            style={{
              position: 'absolute',
              width: BALL_SIZE,
              height: BALL_SIZE,
              borderRadius: BALL_SIZE / 2,
              backgroundColor: '#e94560',
              left: e.x - BALL_SIZE / 2,
              top:  e.y - BALL_SIZE / 2,
            }}
          />
        );
      })}
    </GameEngine>
  );
}
```

---

## SkiaGameEngine (High-Performance Mode)

Uses `@shopify/react-native-skia` and `react-native-reanimated` for smooth rendering. The game loop (systems) runs on the **JS thread** via `requestAnimationFrame` — same as `GameEngine`, so your systems are plain JS functions with no restrictions. The difference is in rendering: entity state is written into a Reanimated `SharedValue` each frame, and Skia draws on the **UI thread** via a Reanimated worklet — no `setState`, no React reconciler per frame.

Result: **60–120 fps** (see [Performance & FPS](#performance--fps) for device requirements).

### Install Peer Dependencies

`@shopify/react-native-skia` v2+ requires `react-native-worklets` as its own peer dependency. Install all three together:

```sh
npm install @shopify/react-native-skia react-native-worklets react-native-reanimated
# or
yarn add @shopify/react-native-skia react-native-worklets react-native-reanimated
```

**iOS** — run pod install after adding the packages:

```sh
cd ios && pod install
```

### Configure Babel

Follow the [Reanimated setup guide](https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/getting-started/) and register the Babel plugin in your `babel.config.js`.

> **Important:** `react-native-reanimated/plugin` **must be the last plugin** in the array.

```js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // ... other plugins ...
    'react-native-reanimated/plugin', // MUST be last
  ],
};
```

### How Worklets Power the Renderer

`SkiaGameEngine` uses a Reanimated `useDerivedValue` with the `'worklet'` directive. This means the Skia draw callback runs entirely on the **UI thread** — it reads entity state from a `SharedValue` that the JS game loop updates each frame. There is no bridge crossing, no `setState`, and no React reconciliation in the render path.

```
JS thread                          UI thread
──────────────────────────────     ──────────────────────────────
requestAnimationFrame callback     Reanimated worklet
  → run systems                      → read entitiesShared.value
  → entitiesShared.value = state     → record Skia draw commands
                                     → display frame
```

You do not need to write worklets yourself — your systems are always plain JS functions. The worklet boundary is internal to `SkiaGameEngine`.

### Usage

Add a `renderer` field to each entity. `SkiaGameEngine` reads it and draws on the UI thread — you do not render `View` children yourself.

```tsx
import { useState } from 'react';
import { Dimensions } from 'react-native';
import { SkiaGameEngine, type Entities, type System } from 'rn-game-engine-next';

const BALL_SIZE = 20;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const BounceSystem: System = (entities, { time }) => {
  const ball = entities['ball'];
  if (!ball) return entities;

  let x = (ball.x as number) + (ball.vx as number) * time.deltaSeconds;
  let y = (ball.y as number) + (ball.vy as number) * time.deltaSeconds;
  let vx = ball.vx as number;
  let vy = ball.vy as number;

  if (x <= BALL_SIZE / 2)            { x = BALL_SIZE / 2;            vx =  Math.abs(vx); }
  if (x >= SCREEN_W - BALL_SIZE / 2) { x = SCREEN_W - BALL_SIZE / 2; vx = -Math.abs(vx); }
  if (y <= BALL_SIZE / 2)            { y = BALL_SIZE / 2;            vy =  Math.abs(vy); }
  if (y >= SCREEN_H - BALL_SIZE / 2) { y = SCREEN_H - BALL_SIZE / 2; vy = -Math.abs(vy); }

  return { ...entities, ball: { ...ball, x, y, vx, vy } };
};

const INITIAL_ENTITIES: Entities = {
  ball: {
    id: 'ball',
    x: SCREEN_W / 2,
    y: SCREEN_H / 2,
    vx: 120,
    vy: 90,
    renderer: { type: 'circle', radius: BALL_SIZE / 2, color: '#e94560' },
  },
};

export default function App() {
  const [fps, setFps] = useState(0);

  return (
    <SkiaGameEngine
      style={{ flex: 1 }}
      systems={[BounceSystem]}
      entities={INITIAL_ENTITIES}
      running={true}
      onUpdate={(_entities, time) => setFps(time.fps)}
    />
  );
}
```

### SkiaRenderer Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `type` | `'circle' \| 'rect'` | — | Shape to draw |
| `color` | `string` | `'#ffffff'` | CSS color string |
| `opacity` | `number` | `1` | Alpha value (0–1) |
| `radius` | `number` | `10` | Circle radius (circle only) |
| `width` | `number` | `50` | Rect width (rect only) |
| `height` | `number` | `50` | Rect height (rect only) |

> `x` / `y` on the entity are always the **centre point** of the rendered shape.

---

## Core Concepts

### Entities

An entity is a plain JavaScript object with any fields you choose. The engine stores all entities in a `Record<string | number, Entity>` map:

```ts
type Entities = Record<string | number, Entity>;

const entities: Entities = {
  player: { id: 'player', x: 100, y: 200, hp: 3 },
  enemy1: { id: 'enemy1', x: 300, y: 100, hp: 1 },
};
```

### Systems

A system is a **pure function** that receives the current entity map plus a context object, and returns the updated entity map.

```ts
type System = (entities: Entities, context: SystemContext) => Entities;
```

`SystemContext` provides:

| Property | Type | Description |
|---|---|---|
| `time.deltaSeconds` | `number` | Seconds elapsed since the last frame — use for physics |
| `time.delta` | `number` | Milliseconds since the last frame |
| `time.current` | `number` | Total ms elapsed since engine start |
| `time.fps` | `number` | Current frames per second (smoothed) |
| `touches` | `TouchEvent[]` | Touch events that occurred this frame |
| `events` | `GameEvent[]` | Game events dispatched this frame |
| `dispatch(event)` | `fn` | Emit a game event to React |
| `accelerometer` | `AccelerometerData \| null` | Sensor data (if `inputs` includes `'accelerometer'`) |
| `gyroscope` | `GyroscopeData \| null` | Sensor data (if `inputs` includes `'gyroscope'`) |

### Systems Execution Order

Systems in the `systems` array are executed **sequentially, left to right**, every frame. The output entities of each system are passed as input to the next. Order matters — structure your pipeline so that upstream systems produce data that downstream systems can consume.

**Recommended ordering:**

```
1. Input systems      — read touches / sensor data, set intent flags on entities
2. Physics systems    — apply gravity, velocity, collision detection
3. Game logic systems — AI, scoring, state transitions
4. Cleanup systems    — remove dead entities, reset frame flags
```

```tsx
import {
  createArcadePhysicsSystem,
} from 'rn-game-engine-next';

const InputSystem: System = (entities, { touches }) => {
  // reads touches, sets player.jumping = true
  return entities;
};

const PhysicsSystem = createArcadePhysicsSystem({ gravity: { x: 0, y: 0.5 } });

const EnemyAISystem: System = (entities) => {
  // moves enemies toward player — depends on player position set by PhysicsSystem
  return entities;
};

const CleanupSystem: System = (entities) => {
  // removes entities with hp <= 0
  return entities;
};

// Order is critical — physics runs before AI so AI sees updated positions
<GameEngine systems={[InputSystem, PhysicsSystem, EnemyAISystem, CleanupSystem]} />
```

**Example — gravity system:**

```ts
const GravitySystem: System = (entities, { time }) => {
  const player = entities['player'];
  if (!player) return entities;

  const vy = (player.vy as number) + 980 * time.deltaSeconds; // 980 px/s²
  const y  = (player.y  as number) + vy  * time.deltaSeconds;

  return { ...entities, player: { ...player, y, vy } };
};
```

### Touch Handling

Touch events are batched per frame and delivered via `context.touches`. Each event has a `type` and an array of touch points.

```ts
type TouchEventType = 'start' | 'end' | 'move' | 'press' | 'long-press';

interface TouchPoint {
  id: number;
  x: number;
  y: number;
  timestamp: number;
}
```

```ts
const TouchSystem: System = (entities, { touches }) => {
  for (const event of touches) {
    if (event.type === 'start') {
      const [touch] = event.touches;
      // e.g. fire a projectile toward touch.x, touch.y
      console.log('Tapped at', touch?.x, touch?.y);
    }
  }
  return entities;
};
```

Touch input is enabled by default. Pass `inputs={['touch']}` (or omit `inputs`) to keep it active.

### Events

Dispatch events from inside a system and handle them in React:

```ts
// Inside a system
if ((entities.player?.hp as number) <= 0) {
  context.dispatch({ type: 'player-died', payload: { score: 1200 } });
}
```

```tsx
// In React
<GameEngine
  onEvent={(event) => {
    if (event.type === 'player-died') {
      setGameOver(true);
      setFinalScore((event.payload as any).score);
    }
  }}
/>
```

---

## Hooks

### `useGameLoop`

Low-level hook that manages a game loop lifecycle. Useful when building custom engines or non-standard loop patterns.

```ts
import { useGameLoop } from 'rn-game-engine-next';

function MyComponent() {
  const loop = useGameLoop({
    fps: 60,
    running: true,
    onUpdate: (time) => {
      console.log(time.fps, time.deltaSeconds);
    },
  });

  // loop.start() / loop.stop() / loop.isRunning()
}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `fps` | `number` | `60` | Target frames per second |
| `running` | `boolean` | `true` | Start/pause the loop |
| `onUpdate` | `(time: GameTime) => void` | — | Called each frame |

Returns a `GameLoopHandle`: `{ start, stop, isRunning }`.

### `useEntities`

Manages an entity map with stable references. Uses an internal mutable ref for the hot loop path and triggers a React re-render only when you explicitly call one of the mutation methods.

```ts
import { useEntities } from 'rn-game-engine-next';

function MyGame() {
  const {
    entities,
    addEntity,
    removeEntity,
    updateEntity,
    setEntities,
    resetEntities,
  } = useEntities({
    player: { id: 'player', x: 100, y: 100, hp: 3 },
  });

  const spawnEnemy = () => {
    // Returns the generated or provided ID
    const id = addEntity({ x: 300, y: 50, hp: 1 });
    console.log('Spawned enemy', id);
  };

  const damagePlayer = () => {
    updateEntity('player', { hp: (entities.player?.hp as number) - 1 });
  };

  const handleGameOver = () => {
    resetEntities(); // back to initial entities
  };
}
```

| Method | Description |
|---|---|
| `entities` | Current entity map (mutable ref — read-only externally) |
| `addEntity(entity)` | Adds entity, auto-generates `id` if omitted. Returns the `id`. |
| `removeEntity(id)` | Removes entity by ID |
| `updateEntity(id, patch)` | Shallow-merges `patch` into entity |
| `setEntities(map)` | Replaces the entire entity map |
| `resetEntities(initial?)` | Resets to the initial map (or a provided one) |

### `useGameEngine`

Accesses the engine context from any child component rendered inside `<GameEngine>`.

```ts
import { useGameEngine } from 'rn-game-engine-next';

function ScoreDisplay() {
  const { entities, dispatch, time, running, start, stop } = useGameEngine();

  return (
    <Text>
      Score: {entities.score?.value as number} | FPS: {time.fps}
    </Text>
  );
}
```

| Value | Type | Description |
|---|---|---|
| `entities` | `Entities` | Current entity snapshot |
| `dispatch` | `(event: GameEvent) => void` | Dispatch a game event |
| `time` | `GameTime` | Current frame time info |
| `running` | `boolean` | Whether the loop is active |
| `start()` | `fn` | Resume the loop |
| `stop()` | `fn` | Pause the loop |

> `useGameEngine` throws if used outside a `<GameEngine>` or `<SkiaGameEngine>`.

---

## Entity Manager

A set of pure utility functions for working with entity maps. These are used internally by `useEntities` but are also exported for use in systems, custom hooks, or anywhere you manage entities outside a hook.

```ts
import {
  generateEntityId,
  addEntity,
  removeEntity,
  updateEntity,
  queryEntities,
  getEntity,
  entitiesToMap,
  cloneEntities,
} from 'rn-game-engine-next';
```

| Function | Signature | Description |
|---|---|---|
| `generateEntityId()` | `() => number` | Returns a unique auto-incrementing numeric ID |
| `addEntity(entities, entity)` | `(Entities, Entity) => Entities` | Adds or replaces an entity (immutable) |
| `removeEntity(entities, id)` | `(Entities, EntityId) => Entities` | Removes entity by ID (immutable) |
| `updateEntity(entities, id, patch)` | `(Entities, EntityId, Partial<Entity>) => Entities` | Shallow-merges patch into entity (immutable) |
| `getEntity(entities, id)` | `(Entities, EntityId) => Entity \| undefined` | Returns a single entity by ID |
| `queryEntities(entities, ...keys)` | `(Entities, ...string[]) => Entity[]` | Returns all entities that have **all** the given keys |
| `entitiesToMap(list)` | `(Entity[]) => Entities` | Converts an array of entities to an `Entities` map |
| `cloneEntities(entities)` | `(Entities) => Entities` | Shallow-copies the entity map |

**Example — querying entities by component:**

```ts
// Returns every entity that has both 'x' and 'hp' fields
const aliveEnemies = queryEntities(entities, 'x', 'hp');
```

**Example — using entity manager in a system:**

```ts
import { removeEntity, queryEntities } from 'rn-game-engine-next';

const CleanupSystem: System = (entities) => {
  let current = entities;
  for (const entity of queryEntities(entities, 'hp')) {
    if ((entity.hp as number) <= 0) {
      current = removeEntity(current, entity.id);
    }
  }
  return current;
};
```

---

## Scene Manager

`SceneManager` lets you define named scenes — each with its own entities and systems. Switching scenes replaces the active entity map and systems array.

```ts
import { SceneManager, type SceneMap } from 'rn-game-engine-next';

const scenes: SceneMap = {
  menu: {
    systems: [MenuInputSystem],
    entities: { menuBg: { id: 'menuBg', ... } },
  },
  game: {
    systems: [InputSystem, PhysicsSystem, EnemyAISystem],
    entities: () => buildGameEntities(), // factory for fresh state each load
  },
  gameOver: {
    systems: [GameOverSystem],
    entities: { overlay: { id: 'overlay', ... } },
  },
};

const manager = new SceneManager(scenes, 'menu');

// Transition to another scene
manager.transitionTo('game');

// Read active state for the engine
const entities = manager.getEntities();
const systems  = manager.getSystems();
```

You can also pass scenes directly to `<GameEngine>` / `<SkiaGameEngine>`:

```tsx
<GameEngine
  scenes={scenes}
  activeScene="game"
  systems={[]}   // overridden by the active scene's systems
  entities={{}}  // overridden by the active scene's entities
/>
```

### SceneManager API

| Method | Description |
|---|---|
| `transitionTo(name)` | Activates the named scene (loads its entities and systems) |
| `getEntities()` | Returns the active scene's entity map |
| `getSystems()` | Returns the active scene's system array |
| `getActiveSceneName()` | Returns the name of the active scene, or `null` |
| `getActiveScene()` | Returns the `SceneDefinition` object, or `null` |
| `addScene(name, scene)` | Registers a new scene at runtime |
| `removeScene(name)` | Removes a scene by name |
| `hasScene(name)` | Returns `true` if the scene is registered |

---

## Physics

### Arcade Physics

A built-in AABB (axis-aligned bounding box) physics system with gravity and collision resolution. Zero external dependencies.

```ts
import { createArcadePhysicsSystem } from 'rn-game-engine-next';

const physics = createArcadePhysicsSystem({
  gravity: { x: 0, y: 0.5 },         // pixels per frame² (normalized to 60fps)
  onCollision: (idA, idB) => {         // called when two bodies overlap
    console.log(idA, 'hit', idB);
  },
});

<GameEngine systems={[physics, myGameSystem]} />
```

Entities are picked up by the arcade system if they have `x`, `y`, `width`, and `height` fields. Additional body properties:

| Field | Type | Default | Description |
|---|---|---|---|
| `bodyType` | `'dynamic' \| 'static'` | `'dynamic'` | `static` bodies don't move and block dynamic ones |
| `velocityX` | `number` | `0` | Horizontal velocity |
| `velocityY` | `number` | `0` | Vertical velocity |
| `collisionGroup` | `string` | — | Group name for this body |
| `collidesWith` | `string[]` | — | Only collide with bodies in these groups |

**Example — platformer ground:**

```ts
const INITIAL_ENTITIES: Entities = {
  player: {
    id: 'player', x: 100, y: 50, width: 32, height: 48,
    velocityX: 0, velocityY: 0, bodyType: 'dynamic',
  },
  ground: {
    id: 'ground', x: 0, y: 600, width: 800, height: 40,
    bodyType: 'static',
  },
};
```

### Matter.js Physics

A zero-config bridge around [matter-js](https://brm.io/matter-js/) for advanced simulation (rigid bodies, constraints, complex shapes).

**Install matter-js first:**

```sh
yarn add matter-js @types/matter-js
```

```ts
import { createMatterPhysicsSystem } from 'rn-game-engine-next';

const physics = createMatterPhysicsSystem({
  gravity: { x: 0, y: 1, scale: 0.001 },
});

<GameEngine systems={[physics, myGameSystem]} />
```

Entities that have a `_matterBody` field are synced — the system reads the Matter body's position and angle and writes them back to `entity.x`, `entity.y`, and `entity.angle` each frame.

> If `matter-js` is not installed, the system logs a warning and is a no-op. Your game won't crash.

---

## Haptics

`HapticManager` provides haptic feedback using the native TurboModule included in this library. No additional packages are required. Falls back to the `Vibration` API on Android when the native module is unavailable.

```ts
import { HapticManager } from 'rn-game-engine-next';

// Convenience wrappers
HapticManager.light();
HapticManager.medium();
HapticManager.heavy();
HapticManager.success();
HapticManager.warning();
HapticManager.error();

// Or by type
HapticManager.trigger('medium');

// Disable/enable globally (e.g. for a settings toggle)
HapticManager.setEnabled(false);
HapticManager.isEnabled(); // false
```

| Type | Pattern |
|---|---|
| `light` | Single short tap |
| `medium` | Single medium tap |
| `heavy` | Single strong tap |
| `success` | Double light tap |
| `warning` | Double medium tap |
| `error` | Triple strong tap |

**Usage inside a system:**

```ts
import { HapticManager } from 'rn-game-engine-next';

const CollisionSystem: System = (entities, { time }) => {
  // ... collision logic ...
  if (playerHitEnemy) {
    HapticManager.heavy();
  }
  return entities;
};
```

---

## Sensors

`SensorBridge` wraps `react-native-sensors` for accelerometer and gyroscope input. The bridge gracefully no-ops (with a console warning) if the package is not installed.

**Install react-native-sensors (optional):**

```sh
yarn add react-native-sensors
cd ios && pod install
```

### Enabling Sensors in the Engine

Pass the desired sensors in the `inputs` prop. The engine starts/stops sensors automatically:

```tsx
<GameEngine
  inputs={['touch', 'accelerometer', 'gyroscope']}
  systems={[TiltSystem]}
  entities={INITIAL_ENTITIES}
/>
```

Sensor data is then available in `SystemContext`:

```ts
const TiltSystem: System = (entities, { accelerometer, gyroscope }) => {
  if (!accelerometer) return entities;

  const { x, y } = accelerometer; // device tilt
  const player = entities['player'];
  if (!player) return entities;

  return {
    ...entities,
    player: {
      ...player,
      vx: (player.vx as number) + x * 2,
      vy: (player.vy as number) + y * 2,
    },
  };
};
```

### Manual SensorBridge Usage

For use outside of the engine components:

```ts
import { SensorBridge } from 'rn-game-engine-next';

const sensors = new SensorBridge();

sensors.startAccelerometer(16, (data) => {
  console.log(data.x, data.y, data.z);
});

sensors.startGyroscope(16, (data) => {
  console.log(data.x, data.y, data.z);
});

// When done
sensors.stopAll();
// or individually:
sensors.stopAccelerometer();
sensors.stopGyroscope();
```

The interval is in milliseconds (`16` ≈ 60 Hz, `8` ≈ 120 Hz).

---

## API Reference

### `<GameEngine>` / `<SkiaGameEngine>` Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `systems` | `System[]` | `[]` | Systems executed every frame in order |
| `entities` | `Entities \| () => Entities` | `{}` | Initial entity map (factory function for fresh state) |
| `running` | `boolean` | `true` | Pause (`false`) or resume (`true`) the loop |
| `onUpdate` | `(entities, time) => void` | — | Called every frame after systems run |
| `onEvent` | `(event) => void` | — | Called when a system calls `dispatch()` |
| `physics` | `'arcade' \| 'matter'` | — | Built-in physics preset |
| `inputs` | `InputSource[]` | `['touch']` | Active input sources: `'touch'`, `'accelerometer'`, `'gyroscope'` |
| `scenes` | `SceneMap` | — | Named scene definitions |
| `activeScene` | `string` | — | Key of the initially active scene |
| `style` | `ViewStyle` | — | Style applied to the canvas container |
| `children` | `ReactNode` | — | `GameEngine` only — rendered as entity views |

---

## Performance & FPS

### Why `SkiaGameEngine` is faster

`GameEngine` calls React `setState` every frame, triggering the React reconciler and JS bridge on every tick. `SkiaGameEngine` bypasses this entirely — entity state is written to a Reanimated `SharedValue` and Skia reads it directly on the UI thread via a worklet, achieving zero React re-renders per frame.

### Reaching 120 fps on iOS

The engine is capable of 120 fps, but two conditions must both be met:

**1. ProMotion hardware**

120 Hz is only available on ProMotion-equipped iPhones:

| Model | Display |
|---|---|
| iPhone 13 / 14 / 15 (standard & Plus) | 60 Hz |
| iPhone 13 Pro / Pro Max and later | 120 Hz ProMotion |
| iPhone 14 Pro / Pro Max | 120 Hz ProMotion |
| iPhone 15 Pro / Pro Max | 120 Hz ProMotion |

**2. Info.plist opt-in**

Even on ProMotion devices, iOS caps `CADisplayLink` (which drives Reanimated's frame callback) to 60 fps by default. Add the following key to your app's `ios/<YourApp>/Info.plist` to remove the cap:

```xml
<key>CADisableMinimumFrameDurationOnPhone</key>
<true/>
```

Without this key, a ProMotion iPhone will still run at 60 fps regardless of the hardware refresh rate.

> **Note:** If you are using this library's example app, the key is already present in `example/ios/RnGameEngineNextExample/Info.plist`.

### Reaching 120 fps on Android

High-refresh-rate Android devices (e.g. Samsung S21 Ultra) require both hardware support and two software opt-ins.

**1. Device display setting**

On Samsung One UI and similar skins, the refresh rate defaults to "Adaptive" or is locked at 60 Hz unless the user enables it manually:

> **Settings → Display → Motion Smoothness → High (120 Hz)**

Without this, the display — and therefore `requestAnimationFrame` — will tick at 60 Hz regardless of your code.

**2. AndroidManifest.xml opt-in**

Android 11+ (API 30+) requires apps to declare that they want high refresh rates. Add the following inside the `<application>` tag in `android/app/src/main/AndroidManifest.xml`:

```xml
<application ...>
  <!-- Allow the system to use the highest available display refresh rate -->
  <meta-data
    android:name="android.max_aspect"
    android:value="9.9" />
</application>
```

And set the window flag in your `MainActivity`. For React Native New Architecture with `ReactActivity`:

```kotlin
// android/app/src/main/java/<yourpackage>/MainActivity.kt
import android.os.Bundle
import android.view.WindowManager

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    // Request highest available refresh rate
    window.attributes = window.attributes.also {
      it.preferredRefreshRate = 120f
    }
  }
  // ...
}
```

> **Note:** `preferredRefreshRate` is a hint — the system may honour a lower rate if the device is under thermal throttling. On Android 12+ you can use `setFrameRate()` on a `Surface` for a harder request, but that requires native code.

---

## Roadmap

- **Phase 1** *(current)* — `GameEngine` (JS-thread rendering) + `SkiaGameEngine` (UI-thread Skia rendering via Reanimated worklets)
- **Phase 2** — `ReanimatedGameEngine` — both the game loop and systems run as Reanimated worklets on the UI thread, achieving 120 fps with zero JS involvement per frame

---

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)

---

## License

MIT
