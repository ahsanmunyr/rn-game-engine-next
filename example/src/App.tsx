import { useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import {
  // ─── OPTION 1 ── uncomment GameEngine ───────────────────────────────────────
  GameEngine,
  // ─── OPTION 2 ── uncomment SkiaGameEngine ───────────────────────────────────
  // SkiaGameEngine,
  type Entities,
  type GameTime,
  type System,
  type GameEvent,
  SkiaGameEngine,
} from 'rn-game-engine-next';

// ─────────────────────────────────────────────────────────────────────────────
//  PERFORMANCE GUIDE — uncomment ONE engine block at a time, rebuild & test
// ─────────────────────────────────────────────────────────────────────────────
//
//  OPTION 1 — GameEngine                                      ~30–40 FPS
//  ─────────────────────────────────────────────────────────────────────
//  • Uses React setState() every frame
//  • React reconciler + JS bridge runs on every tick
//  • No extra dependencies needed
//  • How to activate:
//      1. Import  GameEngine   (already imported above)
//      2. Uncomment the <GameEngine> block below
//      3. Comment out the <SkiaGameEngine> block below
//
//  OPTION 2 — SkiaGameEngine                                  ~60–120 FPS
//  ─────────────────────────────────────────────────────────────────────
//  • Game loop runs on UI thread via Reanimated useFrameCallback
//  • Rendering via Skia PictureRecorder on UI thread
//  • Zero React re-renders per frame — no JS bridge per tick
//  • Needs: @shopify/react-native-skia  react-native-reanimated
//  • How to activate:
//      1. Import  SkiaGameEngine  (uncomment above)
//      2. Comment out  GameEngine  import above
//      3. Uncomment the <SkiaGameEngine> block below
//      4. Comment out the <GameEngine> block below
//
// ─────────────────────────────────────────────────────────────────────────────

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

export default function App() {
  const [fps, setFps] = useState(0);
  const [running, setRunning] = useState(true);

  // ── OPTION 1 only — entities state drives React View positions ─────────────
  const [entities, setEntities] = useState<Entities>({
    ball: { id: 'ball', x: 150, y: 300, vx: 120, vy: 90 },
  });

  const handleEvent = (_event: GameEvent) => {
    // handle game events
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>rn-game-engine-next</Text>
      <Text style={styles.fps}>FPS: {fps}</Text>
      <Text style={styles.hint} onPress={() => setRunning((r) => !r)}>
        Tap to {running ? 'Pause' : 'Resume'}
      </Text>

      {/* ══════════════════════════════════════════════════════════════════════
          OPTION 1 — GameEngine — ~30–40 FPS
          HOW: Keep this block, comment out OPTION 2 block below
          WHY SLOW: setState every frame → React reconciler → JS bridge
          ════════════════════════════════════════════════════════════════════ */}
      {/* <GameEngine
        style={styles.engine}
        systems={[BounceSystem]}
        entities={{ ball: { id: 'ball', x: 150, y: 300, vx: 120, vy: 90 } }}
        running={running}
        onUpdate={(updatedEntities: Entities, time: GameTime) => {
          setFps(time.fps);
          setEntities({ ...updatedEntities });
        }}
        onEvent={handleEvent}
      >
        {Object.values(entities).map((entity) => {
          const e = entity as { id: string; x: number; y: number };
          return (
            <View
              key={e.id}
              style={[
                styles.ball,
                { left: e.x - BALL_SIZE / 2, top: e.y - BALL_SIZE / 2 },
              ]}
            />
          );
        })}
      </GameEngine> */}

      {/* ══════════════════════════════════════════════════════════════════════
          OPTION 2 — SkiaGameEngine — ~60–120 FPS
          HOW: Uncomment this block, comment out OPTION 1 block above
          WHY FAST: useFrameCallback on UI thread + Skia PictureRecorder
                    Zero React re-renders per frame, no JS bridge per tick
          NEEDS:    yarn add @shopify/react-native-skia react-native-reanimated
          ════════════════════════════════════════════════════════════════════ */}

      <SkiaGameEngine
        style={styles.engine}
        systems={[BounceSystem]}
        entities={{
          ball: {
            id: 'ball',
            x: SCREEN_W / 2,
            y: SCREEN_H / 2,
            vx: 120,
            vy: 90,
            renderer: {
              type: 'circle',
              radius: BALL_SIZE / 2,
              color: '#e94560',
            },
          },
        }}
        running={running}
        onUpdate={(_entities, time) => setFps(time.fps)}
        onEvent={handleEvent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
  },
  title: {
    color: '#e94560',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 60,
  },
  fps: {
    fontSize: 14,
    marginTop: 8,
    color: '#aaa',
  },
  hint: {
    color: '#e94560',
    marginTop: 8,
    fontSize: 14,
  } as const,
  engine: {
    flex: 1,
    width: '100%',
    marginTop: 16,
  },
  ball: {
    position: 'absolute',
    width: BALL_SIZE,
    height: BALL_SIZE,
    borderRadius: BALL_SIZE / 2,
    backgroundColor: '#e94560',
  },
});
