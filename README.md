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
| Rendering | React `View` children (JS thread) | Skia canvas via Reanimated `useDerivedValue` (UI thread) |
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

Uses `@shopify/react-native-skia` and `react-native-reanimated` for smooth rendering. The game loop (systems) runs on the **JS thread** via `requestAnimationFrame` — same as `GameEngine`, so your systems are plain JS functions with no restrictions. The difference is in rendering: entity state is written into a Reanimated `SharedValue` each frame, and Skia draws on the **UI thread** via `useDerivedValue` — no `setState`, no React reconciler per frame.

Result: **60–120 fps** (see [Performance & FPS](#performance--fps) for device requirements).

### Install Peer Dependencies

```sh
npm install @shopify/react-native-skia react-native-reanimated
# or
yarn add @shopify/react-native-skia react-native-reanimated
```

**iOS** — run pod install after adding the packages:

```sh
cd ios && pod install
```

Follow the [Reanimated setup guide](https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/getting-started/) to register the Babel plugin in your `babel.config.js`:

```js
module.exports = {
  presets: ['metro-react-native-babel-preset'],
  plugins: ['react-native-reanimated/plugin'],
};
```

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

A system is a **pure function** that receives the current entity map plus a context object, and returns the updated entity map. Systems run sequentially in array order every frame.

```ts
type System = (entities: Entities, context: SystemContext) => Entities;
```

`SystemContext` provides:

| Property | Description |
|---|---|
| `time.deltaSeconds` | Seconds elapsed since the last frame — use this for physics |
| `time.fps` | Current frames per second |
| `touches` | Touch events that occurred this frame |
| `events` | Game events dispatched this frame |
| `dispatch(event)` | Emit a game event to React |
| `accelerometer` | Sensor data (if `inputs` includes `'accelerometer'`) |
| `gyroscope` | Sensor data (if `inputs` includes `'gyroscope'`) |

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

### Events

Dispatch events from inside a system and handle them in React:

```ts
// Inside a system
if (playerHp <= 0) {
  context.dispatch({ type: 'player-died' });
}
```

```tsx
// In React
<GameEngine
  onEvent={(event) => {
    if (event.type === 'player-died') {
      setGameOver(true);
    }
  }}
/>
```

---

## API Reference

### `<GameEngine>` / `<SkiaGameEngine>` Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `systems` | `System[]` | `[]` | Systems executed every frame in order |
| `entities` | `Entities \| () => Entities` | `{}` | Initial entity map |
| `running` | `boolean` | `true` | Pause (`false`) or resume (`true`) the loop |
| `onUpdate` | `(entities, time) => void` | — | Called every frame after systems run |
| `onEvent` | `(event) => void` | — | Called when a system calls `dispatch()` |
| `physics` | `'arcade' \| 'matter'` | — | Built-in physics preset |
| `inputs` | `InputSource[]` | `['touch']` | Active input sources: `touch`, `accelerometer`, `gyroscope` |
| `scenes` | `SceneMap` | — | Named scene definitions |
| `activeScene` | `string` | — | Key of the initially active scene |
| `style` | `ViewStyle` | — | Style applied to the canvas container |
| `children` | `ReactNode` | — | `GameEngine` only — rendered as entity views |

---

## Performance & FPS

### Why `SkiaGameEngine` is faster

`GameEngine` calls React `setState` every frame, triggering the React reconciler and JS bridge on every tick. `SkiaGameEngine` bypasses this entirely — entity state is written to a Reanimated `SharedValue` and Skia reads it directly on the UI thread, achieving zero React re-renders per frame.

### Reaching 120 fps on iOS

The engine is capable of 120 fps, but two conditions must both be met:

**1. ProMotion hardware**

120 Hz is only available on ProMotion-equipped iPhones. Standard models are capped at 60 Hz in hardware:

| Model | Display |
|---|---|
| iPhone 13 / 14 / 15 (standard & Plus) | 60 Hz |
| iPhone 13 Pro / Pro Max and later | 120 Hz ProMotion |
| iPhone 14 Pro / Pro Max | 120 Hz ProMotion |
| iPhone 15 Pro / Pro Max | 120 Hz ProMotion |

**2. Info.plist opt-in**

Even on ProMotion devices, iOS caps `CADisplayLink` (which drives Reanimated's `useFrameCallback`) to 60 fps by default. Add the following key to your app's `ios/<YourApp>/Info.plist` to remove the cap:

```xml
<key>CADisableMinimumFrameDurationOnPhone</key>
<true/>
```

Without this key, a ProMotion iPhone will still run at 60 fps regardless of the hardware refresh rate.

> **Note:** If you are using this library's example app, the key is already present in `example/ios/RnGameEngineNextExample/Info.plist`.

---

## Roadmap

- **Phase 1** *(current)* — `GameEngine` (JS-thread rendering) + `SkiaGameEngine` (UI-thread Skia rendering)
- **Phase 2** — `ReanimatedGameEngine` — both the game loop and systems run as Reanimated worklets on the UI thread, achieving 120 fps with zero JS involvement per frame

---

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)

---

## License

MIT
