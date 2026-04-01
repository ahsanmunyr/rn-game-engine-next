# rn-game-engine-next

A New Architecture React Native game engine — zero required dependencies, with an optional high-performance Skia renderer for 60–120 fps gameplay.

## Installation

```sh
npm install rn-game-engine-next
# or
yarn add rn-game-engine-next
```

## Two rendering modes

| | `GameEngine` | `SkiaGameEngine` |
|---|---|---|
| Extra deps | None | `@shopify/react-native-skia` + `react-native-reanimated` |
| Game loop | JS thread (`requestAnimationFrame`) | JS thread (`requestAnimationFrame`) |
| Rendering | React `View` children (JS thread) | Skia canvas via Reanimated `useDerivedValue` (UI thread) |
| Typical FPS | ~30–40 fps | 60–120 fps |
| Entity rendering | React `View` children | `renderer` field on entity |
| Best for | Prototyping, simple games | Smooth / production games |

---

## GameEngine (simple mode)

No extra dependencies. Entities are rendered as React `View` children. The
game loop runs on the JS thread and calls `setState` each frame — great for
prototyping but capped at ~33 fps on most devices.

### Install

Nothing extra needed.

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

  if (x <= BALL_SIZE / 2) { x = BALL_SIZE / 2; vx = Math.abs(vx); }
  if (x >= SCREEN_W - BALL_SIZE / 2) { x = SCREEN_W - BALL_SIZE / 2; vx = -Math.abs(vx); }
  if (y <= BALL_SIZE / 2) { y = BALL_SIZE / 2; vy = Math.abs(vy); }
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
              top: e.y - BALL_SIZE / 2,
            }}
          />
        );
      })}
    </GameEngine>
  );
}
```

---

## SkiaGameEngine (high-performance mode)

Uses `@shopify/react-native-skia` and `react-native-reanimated` for smooth rendering.
The game loop (systems) runs on the **JS thread** via `requestAnimationFrame` — same as
`GameEngine`, so your systems are plain JS functions with no restrictions. The difference
is in rendering: entity positions are written into a Reanimated `SharedValue` each frame,
and Skia draws them on the **UI thread** via `useDerivedValue` — no `setState`, no React
reconciler per frame. Result: **60–120 fps** (120 on ProMotion displays).

### Install peer dependencies

```sh
npm install @shopify/react-native-skia react-native-reanimated
# or
yarn add @shopify/react-native-skia react-native-reanimated
```

**iOS** — install pods after adding the packages:

```sh
cd ios && pod install
```

Then follow the [Reanimated setup guide](https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/getting-started/) to add the Babel plugin to your `babel.config.js`:

```js
module.exports = {
  presets: ['metro-react-native-babel-preset'],
  plugins: ['react-native-reanimated/plugin'],
};
```

### Usage

Add a `renderer` field to each entity. `SkiaGameEngine` reads it and draws on
the UI thread — you no longer render `View` children yourself.

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

  if (x <= BALL_SIZE / 2) { x = BALL_SIZE / 2; vx = Math.abs(vx); }
  if (x >= SCREEN_W - BALL_SIZE / 2) { x = SCREEN_W - BALL_SIZE / 2; vx = -Math.abs(vx); }
  if (y <= BALL_SIZE / 2) { y = BALL_SIZE / 2; vy = Math.abs(vy); }
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
    // ↓ tells SkiaGameEngine how to draw this entity
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

### SkiaRenderer spec

| Field | Type | Default | Description |
|---|---|---|---|
| `type` | `'circle' \| 'rect'` | — | Shape to draw |
| `color` | `string` | `'#ffffff'` | CSS color string |
| `opacity` | `number` | `1` | Alpha value (0–1) |
| `radius` | `number` | `10` | Circle radius |
| `width` | `number` | `50` | Rect width |
| `height` | `number` | `50` | Rect height |

`x` / `y` on the entity are always used as the **centre point** of the shape.

---

## Core concepts

### Entities

A plain JS object map of `EntityId → Entity`. Each entity is just a data bag — any fields you want:

```ts
type Entities = Record<string | number, Entity>;

// Example
const entities: Entities = {
  player: { id: 'player', x: 100, y: 200, hp: 3 },
  enemy1: { id: 'enemy1', x: 300, y: 100, hp: 1 },
};
```

### Systems

A system is a pure function that receives entities + context and returns updated entities. Systems run in order every frame.

```ts
type System = (entities: Entities, context: SystemContext) => Entities;

// SystemContext provides:
// - time.deltaSeconds  — seconds since last frame (use for physics)
// - time.fps           — current FPS
// - touches            — touch events this frame
// - events             — dispatched game events this frame
// - dispatch()         — emit a game event
// - accelerometer      — sensor data (if enabled)
// - gyroscope          — sensor data (if enabled)
```

### Events

Dispatch events from systems and handle them in React:

```ts
// Inside a system
if (playerHit) {
  context.dispatch({ type: 'player-hit', payload: { damage: 1 } });
}

// In React
<GameEngine
  onEvent={(event) => {
    if (event.type === 'player-hit') {
      setHp((hp) => hp - (event.payload as any).damage);
    }
  }}
/>
```

---

## API reference

### `<GameEngine>` / `<SkiaGameEngine>` props

| Prop | Type | Default | Description |
|---|---|---|---|
| `systems` | `System[]` | `[]` | Systems run every frame |
| `entities` | `Entities \| () => Entities` | `{}` | Initial entity map |
| `running` | `boolean` | `true` | Pause/resume the loop |
| `onUpdate` | `(entities, time) => void` | — | Called every frame |
| `onEvent` | `(event) => void` | — | Called when `dispatch()` is used |
| `physics` | `'arcade' \| 'matter'` | — | Built-in physics preset |
| `inputs` | `InputSource[]` | `['touch']` | `touch`, `accelerometer`, `gyroscope` |
| `scenes` | `SceneMap` | — | Named scene definitions |
| `activeScene` | `string` | — | Initial active scene |
| `style` | `ViewStyle` | — | Style for the canvas container |
| `children` | `ReactNode` | — | `GameEngine` only — entity views |

---

## Roadmap

- **Phase 1** (current): `GameEngine` (JS thread) + `SkiaGameEngine` (UI thread via Skia)
- **Phase 2**: `ReanimatedGameEngine` — game loop + systems run as Reanimated worklets on the UI thread (120 fps, zero JS involvement per frame)

---

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)

## License

MIT
