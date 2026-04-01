import { useRef, useState } from 'react';
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  SkiaGameEngine,
  type Entities,
  type System,
} from 'rn-game-engine-next';

const { width: W, height: H } = Dimensions.get('window');

// ─── Constants ──────────────────────────────────────────────────────────────
const PLAYER_W = 44;
const PLAYER_H = 28;
const BASE_BW = 5; // bullet width
const BASE_BH = 13; // bullet height
const ENEMY_R = 20;
const BOSS_R = 54;
const BOSS_BULLET_R = 7;
const BASE_FIRE_INT = 0.28; // seconds between shots
const PARTICLES_ENEMY = 8;
const STAR_COUNT = 55;
const ENEMY_COLORS = [
  '#ef5350',
  '#ff7043',
  '#ab47bc',
  '#26c6da',
  '#66bb6a',
  '#ffa726',
];

// ─── Power-up definitions ───────────────────────────────────────────────────
type UpgradeId =
  | 'twin_cannon'
  | 'triple_cannon'
  | 'rapid_fire'
  | 'spread_shot'
  | 'power_bullet'
  | 'extra_life';

interface PowerUp {
  id: UpgradeId;
  name: string;
  desc: string;
  icon: string;
}

const ALL_POWERUPS: PowerUp[] = [
  {
    id: 'twin_cannon',
    name: 'TWIN CANNON',
    desc: 'Fire from 2 barrels',
    icon: '⚡',
  },
  {
    id: 'triple_cannon',
    name: 'TRIPLE CANNON',
    desc: 'Fire from 3 barrels',
    icon: '🔱',
  },
  {
    id: 'rapid_fire',
    name: 'RAPID FIRE',
    desc: '40% faster fire rate',
    icon: '🔥',
  },
  {
    id: 'spread_shot',
    name: 'SPREAD SHOT',
    desc: 'Bullets fan outward',
    icon: '💥',
  },
  {
    id: 'power_bullet',
    name: 'POWER BULLET',
    desc: 'Wider shots, double damage',
    icon: '🔶',
  },
  { id: 'extra_life', name: 'EXTRA LIFE', desc: 'Restore 1 life', icon: '❤️' },
];

interface Upgrades {
  gunLevel: 1 | 2 | 3;
  rapidFire: boolean;
  spreadShot: boolean;
  powerBullet: boolean;
}
const BASE_UPGRADES: Upgrades = {
  gunLevel: 1,
  rapidFire: false,
  spreadShot: false,
  powerBullet: false,
};

function applyUpgrade(id: UpgradeId, u: Upgrades): Upgrades {
  switch (id) {
    case 'twin_cannon':
      return { ...u, gunLevel: Math.max(2, u.gunLevel) as 1 | 2 | 3 };
    case 'triple_cannon':
      return { ...u, gunLevel: 3 };
    case 'rapid_fire':
      return { ...u, rapidFire: true };
    case 'spread_shot':
      return { ...u, spreadShot: true };
    case 'power_bullet':
      return { ...u, powerBullet: true };
    default:
      return u;
  }
}

function pickChoices(u: Upgrades, n = 3): PowerUp[] {
  const avail = ALL_POWERUPS.filter((p) => {
    if (p.id === 'twin_cannon') return u.gunLevel < 2;
    if (p.id === 'triple_cannon') return u.gunLevel < 3;
    if (p.id === 'rapid_fire') return !u.rapidFire;
    if (p.id === 'spread_shot') return !u.spreadShot;
    if (p.id === 'power_bullet') return !u.powerBullet;
    return true; // extra_life always available
  });
  return [...avail].sort(() => Math.random() - 0.5).slice(0, n);
}

// ─── Round config ────────────────────────────────────────────────────────────
interface RoundCfg {
  round: number;
  waveTotal: number;
  enemySpeed: number;
  spawnInterval: number;
  bossMaxHp: number;
  bossMoveSpeed: number;
  bossFireInterval: number; // 999 = never
  bossSpread: number;
}

function getRoundCfg(r: number): RoundCfg {
  return {
    round: r,
    waveTotal: 10 + r * 4, // R1:14, R2:18 …
    enemySpeed: 50 + r * 12,
    spawnInterval: Math.max(0.38, 1.2 - (r - 1) * 0.1),
    bossMaxHp: 80 + (r - 1) * 70, // R1:80, R2:150 …
    bossMoveSpeed: 55 + (r - 1) * 25,
    bossFireInterval: r >= 2 ? Math.max(1.4, 3.5 - (r - 1) * 0.5) : 999,
    bossSpread: r >= 3 ? 3 : 1,
  };
}

// ─── Module-level shared state (React → Engine) ──────────────────────────────
let _touchX = W / 2;

interface PendingBoss {
  upgrades: Upgrades;
  cfg: RoundCfg;
  lives: number;
}
let _pendingBoss: PendingBoss | null = null;

// ─── Entity factories ────────────────────────────────────────────────────────
function mkStars(): Entities {
  const out: Entities = {};
  for (let i = 0; i < STAR_COUNT; i++) {
    const r = Math.random() * 1.5 + 0.5;
    out[`star_${i}`] = {
      id: `star_${i}`,
      x: Math.random() * W,
      y: Math.random() * H,
      vy: r * 18 + 5,
      renderer: {
        type: 'circle',
        radius: r,
        color: '#ffffff',
        opacity: Math.random() * 0.5 + 0.25,
      },
    };
  }
  return out;
}

function mkInitial(
  cfg: RoundCfg,
  u: Upgrades,
  lives: number,
  score: number
): Entities {
  return {
    ...mkStars(),
    player: {
      id: 'player',
      x: W / 2,
      y: H - 90,
      renderer: {
        type: 'rect',
        width: PLAYER_W,
        height: PLAYER_H,
        color: '#4fc3f7',
      },
    },
    thruster: {
      id: 'thruster',
      x: W / 2,
      y: H - 90 + PLAYER_H / 2 + 7,
      renderer: { type: 'circle', radius: 7, color: '#ff6d00', opacity: 0.85 },
    },
    gameState: {
      id: 'gameState',
      // ── phase: 'wave' | 'wave_complete' | 'boss' | 'boss_dead' | 'game_over'
      enginePhase: 'wave',
      // ── progress
      round: cfg.round,
      score,
      lives,
      // ── wave
      waveTotal: cfg.waveTotal,
      waveSpawned: 0,
      waveResolved: 0, // killed + escaped, drives wave-complete detection
      spawnInterval: cfg.spawnInterval,
      enemySpeed: cfg.enemySpeed,
      // ── boss config (used when boss starts)
      bossMaxHp: cfg.bossMaxHp,
      bossMoveSpeed: cfg.bossMoveSpeed,
      bossFireInterval: cfg.bossFireInterval,
      bossSpread: cfg.bossSpread,
      bossHp: 0,
      // ── upgrades
      gunLevel: u.gunLevel,
      rapidFire: u.rapidFire,
      spreadShot: u.spreadShot,
      powerBullet: u.powerBullet,
      // ── timing
      elapsed: 0,
      nextFireTime: 0,
      nextEnemyTime: 0.8,
      nextBossFireTime: 9999,
      // ── id sequences
      bulletSeq: 0,
      enemySeq: 0,
      bossBulletSeq: 0,
      particleSeq: 0,
    },
  };
}

// ─── Systems ─────────────────────────────────────────────────────────────────

const TouchSystem: System = (entities, { touches }) => {
  for (const t of touches) {
    if (t.type === 'start' || t.type === 'move' || t.type === 'press') {
      const pt = t.touches[0];
      if (pt) _touchX = pt.x;
    }
  }
  return entities;
};

const StarSystem: System = (entities, { time }) => {
  const next = { ...entities };
  for (let i = 0; i < STAR_COUNT; i++) {
    const s = entities[`star_${i}`];
    if (!s) continue;
    let y = (s.y as number) + (s.vy as number) * time.deltaSeconds;
    if (y > H + 4) y = -4;
    next[`star_${i}`] = { ...s, y };
  }
  return next;
};

const PlayerSystem: System = (entities, { time }) => {
  const gs = entities['gameState'];
  if (!gs || gs.enginePhase === 'game_over') return entities;
  const player = entities['player'];
  const thruster = entities['thruster'];
  if (!player) return entities;
  const dx = _touchX - (player.x as number);
  const move = Math.sign(dx) * Math.min(Math.abs(dx), 390 * time.deltaSeconds);
  const nx = Math.max(
    PLAYER_W / 2 + 4,
    Math.min(W - PLAYER_W / 2 - 4, (player.x as number) + move)
  );
  return {
    ...entities,
    player: { ...player, x: nx },
    ...(thruster ? { thruster: { ...thruster, x: nx } } : {}),
  };
};

// Tick elapsed, fire player bullets based on current upgrade state
const AutoFireSystem: System = (entities, { time }) => {
  const gs = entities['gameState'];
  if (
    !gs ||
    gs.enginePhase === 'game_over' ||
    gs.enginePhase === 'wave_complete'
  )
    return entities;

  const elapsed = (gs.elapsed as number) + time.deltaSeconds;
  const next: Entities = { ...entities, gameState: { ...gs, elapsed } };
  if (elapsed < (gs.nextFireTime as number)) return next;

  const player = entities['player'];
  if (!player) return next;

  const gl = gs.gunLevel as number;
  const spr = gs.spreadShot as boolean;
  const rf = gs.rapidFire as boolean;
  const pb = gs.powerBullet as boolean;
  const bW = pb ? BASE_BW * 2.2 : BASE_BW;
  const bH = pb ? BASE_BH * 1.5 : BASE_BH;
  const col = pb ? '#ff6b35' : '#ffeb3b';
  const interval = rf ? BASE_FIRE_INT * 0.6 : BASE_FIRE_INT;

  const offsets = gl === 3 ? [-22, 0, 22] : gl === 2 ? [-15, 15] : [0];
  const angles = spr ? [-20, 0, 20] : [0];
  const py = (player.y as number) - PLAYER_H / 2 - bH / 2;
  let seq = gs.bulletSeq as number;

  for (const xOff of offsets) {
    for (const deg of angles) {
      const rad = (deg * Math.PI) / 180;
      seq++;
      next[`bullet_${seq}`] = {
        id: `bullet_${seq}`,
        x: (player.x as number) + xOff,
        y: py,
        vx: Math.sin(rad) * 540,
        vy: -Math.cos(rad) * 540,
        renderer: { type: 'rect', width: bW, height: bH, color: col },
      };
    }
  }
  next['gameState'] = {
    ...next['gameState']!,
    nextFireTime: elapsed + interval,
    bulletSeq: seq,
  };
  return next;
};

// Move player bullets; cull when off-screen
const BulletSystem: System = (entities, { time }) => {
  const next: Entities = {};
  for (const [key, e] of Object.entries(entities)) {
    if (key.startsWith('bullet_')) {
      const nx = (e.x as number) + ((e.vx as number) || 0) * time.deltaSeconds;
      const ny = (e.y as number) + (e.vy as number) * time.deltaSeconds;
      if (ny < -30 || nx < -30 || nx > W + 30) continue;
      next[key] = { ...e, x: nx, y: ny };
    } else {
      next[key] = e;
    }
  }
  return next;
};

// Spawn wave enemies until waveTotal reached
const EnemySpawnSystem: System = (entities) => {
  const gs = entities['gameState'];
  if (!gs || gs.enginePhase !== 'wave') return entities;
  if ((gs.waveSpawned as number) >= (gs.waveTotal as number)) return entities;
  const elapsed = gs.elapsed as number;
  if (elapsed < (gs.nextEnemyTime as number)) return entities;

  const seq = (gs.enemySeq as number) + 1;
  const x = ENEMY_R + 6 + Math.random() * (W - (ENEMY_R + 6) * 2);
  const spd = (gs.enemySpeed as number) + Math.random() * 30;
  const color = ENEMY_COLORS[Math.floor(Math.random() * ENEMY_COLORS.length)]!;

  return {
    ...entities,
    [`enemy_${seq}`]: {
      id: `enemy_${seq}`,
      x,
      y: -ENEMY_R,
      vy: spd,
      color,
      renderer: { type: 'circle', radius: ENEMY_R, color },
    },
    gameState: {
      ...gs,
      nextEnemyTime: elapsed + (gs.spawnInterval as number),
      enemySeq: seq,
      waveSpawned: (gs.waveSpawned as number) + 1,
    },
  };
};

// Move enemies; lose a life when one escapes the bottom
const EnemySystem: System = (entities, { time }) => {
  const next: Entities = {};
  let escaped = 0;
  for (const [key, e] of Object.entries(entities)) {
    if (key.startsWith('enemy_')) {
      const ny = (e.y as number) + (e.vy as number) * time.deltaSeconds;
      if (ny > H + ENEMY_R) {
        escaped++;
        continue;
      }
      next[key] = { ...e, y: ny };
    } else {
      next[key] = e;
    }
  }
  if (escaped > 0) {
    const gs = next['gameState'];
    if (gs) {
      const lives = Math.max(0, (gs.lives as number) - escaped);
      const resolved = (gs.waveResolved as number) + escaped;
      next['gameState'] = {
        ...gs,
        lives,
        waveResolved: resolved,
        enginePhase: lives === 0 ? 'game_over' : (gs.enginePhase as string),
      };
    }
  }
  return next;
};

// After all wave enemies are resolved and none remain on-screen, signal wave_complete
const WaveCheckSystem: System = (entities) => {
  const gs = entities['gameState'];
  if (!gs || gs.enginePhase !== 'wave') return entities;
  if ((gs.waveSpawned as number) < (gs.waveTotal as number)) return entities;
  if ((gs.waveResolved as number) < (gs.waveTotal as number)) return entities;
  if (Object.keys(entities).some((k) => k.startsWith('enemy_')))
    return entities;
  return { ...entities, gameState: { ...gs, enginePhase: 'wave_complete' } };
};

// Consume _pendingBoss set by React after power-up selection → spawn boss
const UpgradeSystem: System = (entities) => {
  if (!_pendingBoss) return entities;
  const { upgrades, cfg, lives } = _pendingBoss;
  _pendingBoss = null;
  const gs = entities['gameState'];
  if (!gs) return entities;
  const bossHp = cfg.bossMaxHp;
  return {
    ...entities,
    boss: {
      id: 'boss',
      x: W / 2,
      y: BOSS_R + 30,
      vx: cfg.bossMoveSpeed,
      hp: bossHp,
      maxHp: bossHp,
      bossFireInterval: cfg.bossFireInterval,
      bossSpread: cfg.bossSpread,
      renderer: { type: 'circle', radius: BOSS_R, color: '#ff1744' },
    },
    gameState: {
      ...gs,
      enginePhase: 'boss',
      lives,
      bossHp,
      gunLevel: upgrades.gunLevel,
      rapidFire: upgrades.rapidFire,
      spreadShot: upgrades.spreadShot,
      powerBullet: upgrades.powerBullet,
      nextBossFireTime: (gs.elapsed as number) + 2.0,
    },
  };
};

// Move boss left↔right; change color by HP%; fire back in round 2+
const BossSystem: System = (entities, { time }) => {
  const gs = entities['gameState'];
  if (!gs || gs.enginePhase !== 'boss') return entities;
  const boss = entities['boss'];
  if (!boss) return entities;

  let x = (boss.x as number) + (boss.vx as number) * time.deltaSeconds;
  let vx = boss.vx as number;
  if (x < BOSS_R + 10) {
    x = BOSS_R + 10;
    vx = Math.abs(vx);
  }
  if (x > W - BOSS_R - 10) {
    x = W - BOSS_R - 10;
    vx = -Math.abs(vx);
  }

  const hp = boss.hp as number;
  const pct = hp / (boss.maxHp as number);
  const bossColor = pct > 0.6 ? '#ff1744' : pct > 0.3 ? '#ff6d00' : '#ffeb3b';

  const next: Entities = {
    ...entities,
    boss: {
      ...boss,
      x,
      vx,
      renderer: { ...(boss.renderer as object), color: bossColor },
    },
    gameState: { ...gs, bossHp: hp },
  };

  // Fire boss bullets (round 2+)
  const bfi = boss.bossFireInterval as number;
  const elapsed = gs.elapsed as number;
  if (bfi < 999 && elapsed >= (gs.nextBossFireTime as number)) {
    const spread = (boss.bossSpread as number) || 1;
    const angles = spread === 3 ? [-25, 0, 25] : [0];
    let bbSeq = gs.bossBulletSeq as number;
    for (const deg of angles) {
      const rad = (deg * Math.PI) / 180;
      bbSeq++;
      next[`bbullet_${bbSeq}`] = {
        id: `bbullet_${bbSeq}`,
        x: boss.x,
        y: (boss.y as number) + BOSS_R,
        vx: Math.sin(rad) * 220,
        vy: Math.cos(rad) * 220,
        renderer: { type: 'circle', radius: BOSS_BULLET_R, color: '#ff4444' },
      };
    }
    next['gameState'] = {
      ...next['gameState']!,
      nextBossFireTime: elapsed + bfi,
      bossBulletSeq: bbSeq,
    };
  }
  return next;
};

// Move boss bullets; cull when off-screen
const BossBulletSystem: System = (entities, { time }) => {
  const next: Entities = {};
  for (const [key, e] of Object.entries(entities)) {
    if (key.startsWith('bbullet_')) {
      const nx = (e.x as number) + ((e.vx as number) || 0) * time.deltaSeconds;
      const ny = (e.y as number) + (e.vy as number) * time.deltaSeconds;
      if (ny > H + 20 || nx < -20 || nx > W + 20) continue;
      next[key] = { ...e, x: nx, y: ny };
    } else {
      next[key] = e;
    }
  }
  return next;
};

const CollisionSystem: System = (entities) => {
  const next = { ...entities };

  const bulletKeys = Object.keys(next).filter((k) => k.startsWith('bullet_'));
  const enemyKeys = Object.keys(next).filter((k) => k.startsWith('enemy_'));
  const bbulletKeys = Object.keys(next).filter((k) => k.startsWith('bbullet_'));

  // Helper: burst of particles at (cx,cy)
  function burst(
    cx: number,
    cy: number,
    color: string,
    count: number,
    rRange: [number, number],
    life: number,
    spdRange: [number, number]
  ) {
    const gs = next['gameState'];
    if (!gs) return;
    let pSeq = gs.particleSeq as number;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const spd = spdRange[0] + Math.random() * (spdRange[1] - spdRange[0]);
      next[`particle_${pSeq + i}`] = {
        id: `particle_${pSeq + i}`,
        x: cx,
        y: cy,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life,
        maxLife: life,
        renderer: {
          type: 'circle',
          radius: rRange[0] + Math.random() * (rRange[1] - rRange[0]),
          color,
          opacity: 1,
        },
      };
    }
    next['gameState'] = { ...gs, particleSeq: pSeq + count };
  }

  // ── Player bullets × wave enemies ──────────────────────────────────────
  for (const bKey of bulletKeys) {
    const b = next[bKey];
    if (!b) continue;
    const bx = b.x as number,
      by = b.y as number;
    for (const eKey of enemyKeys) {
      const e = next[eKey];
      if (!e) continue;
      const dx = bx - (e.x as number),
        dy = by - (e.y as number);
      if (Math.sqrt(dx * dx + dy * dy) >= ENEMY_R + BASE_BW) continue;

      delete next[bKey];
      delete next[eKey];

      const gs = next['gameState'];
      if (gs) {
        const resolved = (gs.waveResolved as number) + 1;
        const score = (gs.score as number) + 10 * (gs.round as number);
        next['gameState'] = { ...gs, waveResolved: resolved, score };
        burst(
          e.x as number,
          e.y as number,
          (e.color as string) || '#ef5350',
          PARTICLES_ENEMY,
          [2, 5],
          0.55,
          [70, 200]
        );
      }
      break; // one bullet hits one enemy
    }
  }

  // ── Player bullets × boss ──────────────────────────────────────────────
  const boss = next['boss'];
  if (boss) {
    const damage = (next['gameState']?.powerBullet as boolean) ? 2 : 1;
    for (const bKey of bulletKeys) {
      const b = next[bKey];
      if (!b) continue;
      const dx = (b.x as number) - (boss.x as number);
      const dy = (b.y as number) - (boss.y as number);
      if (Math.sqrt(dx * dx + dy * dy) >= BOSS_R + BASE_BW) continue;

      delete next[bKey];
      const newHp = Math.max(0, (boss.hp as number) - damage);
      burst(
        boss.x as number,
        boss.y as number,
        '#ffffff',
        4,
        [1, 3],
        0.25,
        [50, 100]
      );

      if (newHp <= 0) {
        delete next['boss'];
        // Large multi-colour explosion
        (['#ff1744', '#ff6d00', '#ffeb3b', '#ffffff'] as const).forEach(
          (col) => {
            burst(
              boss.x as number,
              boss.y as number,
              col,
              7,
              [4, 9],
              0.9,
              [100, 300]
            );
          }
        );
        const gs = next['gameState'];
        if (gs)
          next['gameState'] = { ...gs, enginePhase: 'boss_dead', bossHp: 0 };
      } else {
        next['boss'] = { ...boss, hp: newHp };
        const gs = next['gameState'];
        if (gs) next['gameState'] = { ...gs, bossHp: newHp };
      }
    }
  }

  // ── Wave enemies × player ──────────────────────────────────────────────
  const player = next['player'];
  if (player) {
    const px = player.x as number,
      py = player.y as number;
    for (const eKey of enemyKeys) {
      const e = next[eKey];
      if (!e) continue;
      const dx = px - (e.x as number),
        dy = py - (e.y as number);
      if (Math.sqrt(dx * dx + dy * dy) < ENEMY_R + PLAYER_H / 2) {
        delete next[eKey];
        const gs = next['gameState'];
        if (gs) {
          const lives = Math.max(0, (gs.lives as number) - 1);
          const resolved = (gs.waveResolved as number) + 1;
          next['gameState'] = {
            ...gs,
            lives,
            waveResolved: resolved,
            enginePhase: lives === 0 ? 'game_over' : (gs.enginePhase as string),
          };
        }
      }
    }
  }

  // ── Boss bullets × player ──────────────────────────────────────────────
  if (player) {
    const px = player.x as number,
      py = player.y as number;
    for (const bbKey of bbulletKeys) {
      const bb = next[bbKey];
      if (!bb) continue;
      const dx = px - (bb.x as number),
        dy = py - (bb.y as number);
      if (Math.sqrt(dx * dx + dy * dy) < BOSS_BULLET_R + PLAYER_H / 2) {
        delete next[bbKey];
        const gs = next['gameState'];
        if (gs) {
          const lives = Math.max(0, (gs.lives as number) - 1);
          next['gameState'] = {
            ...gs,
            lives,
            enginePhase: lives === 0 ? 'game_over' : (gs.enginePhase as string),
          };
        }
      }
    }
  }

  return next;
};

// Fade and move explosion particles
const ParticleSystem: System = (entities, { time }) => {
  const next: Entities = {};
  for (const [key, e] of Object.entries(entities)) {
    if (key.startsWith('particle_')) {
      const life = (e.life as number) - time.deltaSeconds;
      if (life <= 0) continue;
      next[key] = {
        ...e,
        x: (e.x as number) + (e.vx as number) * time.deltaSeconds,
        y: (e.y as number) + (e.vy as number) * time.deltaSeconds,
        life,
        renderer: {
          ...(e.renderer as object),
          opacity: life / (e.maxLife as number),
        },
      };
    } else {
      next[key] = e;
    }
  }
  return next;
};

const SYSTEMS: System[] = [
  TouchSystem,
  StarSystem,
  PlayerSystem,
  AutoFireSystem,
  BulletSystem,
  EnemySpawnSystem,
  EnemySystem,
  WaveCheckSystem,
  UpgradeSystem,
  BossSystem,
  BossBulletSystem,
  CollisionSystem,
  ParticleSystem,
];

// ─── Component ────────────────────────────────────────────────────────────────
type UIPhase =
  | 'wave'
  | 'powerup_select'
  | 'boss'
  | 'round_complete'
  | 'game_over';

export default function SpaceBlaster() {
  const [uiPhase, setUiPhase] = useState<UIPhase>('wave');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [round, setRound] = useState(1);
  const [bossHp, setBossHp] = useState(0);
  const [bossMaxHp, setBossMaxHp] = useState(0);
  const [fps, setFps] = useState(0);
  const [choices, setChoices] = useState<PowerUp[]>([]);

  // Persisted across round remounts (engineKey resets SkiaGameEngine)
  const engineKey = useRef(0);
  const savedScore = useRef(0);
  const savedLives = useRef(3);
  const currentRound = useRef(1);
  const upgrades = useRef<Upgrades>({ ...BASE_UPGRADES });
  const roundTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Change-tracking to avoid spurious setState calls from onUpdate
  const prev = useRef({ score: -1, lives: -1, bossHp: -1, fps: -1, ep: '' });

  // ── Round lifecycle ──────────────────────────────────────────────────────
  function beginRound(r: number) {
    currentRound.current = r;
    engineKey.current += 1;
    prev.current = { score: -1, lives: -1, bossHp: -1, fps: -1, ep: '' };
    setRound(r);
    setUiPhase('wave');
    setBossHp(0);
    setBossMaxHp(0);
  }

  function onWaveComplete() {
    setChoices(pickChoices(upgrades.current));
    setUiPhase('powerup_select');
  }

  function onPickUpgrade(id: UpgradeId) {
    const newU = applyUpgrade(id, upgrades.current);
    upgrades.current = newU;
    const newLives =
      id === 'extra_life' ? savedLives.current + 1 : savedLives.current;
    savedLives.current = newLives;
    setLives(newLives);

    const cfg = getRoundCfg(currentRound.current);
    setBossMaxHp(cfg.bossMaxHp);
    setBossHp(cfg.bossMaxHp);
    _pendingBoss = { upgrades: newU, cfg, lives: newLives };
    setUiPhase('boss');
  }

  function onRoundComplete(s: number, lv: number) {
    savedScore.current = s;
    savedLives.current = lv;
    setUiPhase('round_complete');
    if (roundTimer.current) clearTimeout(roundTimer.current);
    roundTimer.current = setTimeout(
      () => beginRound(currentRound.current + 1),
      3000
    );
  }

  function restart() {
    if (roundTimer.current) clearTimeout(roundTimer.current);
    upgrades.current = { ...BASE_UPGRADES };
    savedScore.current = 0;
    savedLives.current = 3;
    currentRound.current = 1;
    _pendingBoss = null;
    _touchX = W / 2;
    engineKey.current += 1;
    prev.current = { score: -1, lives: -1, bossHp: -1, fps: -1, ep: '' };
    setScore(0);
    setLives(3);
    setRound(1);
    setBossHp(0);
    setBossMaxHp(0);
    setUiPhase('wave');
  }

  // ── Render ───────────────────────────────────────────────────────────────
  const cfg = getRoundCfg(currentRound.current);

  return (
    <View style={s.root}>
      <SkiaGameEngine
        key={engineKey.current}
        style={s.engine}
        systems={SYSTEMS}
        entities={mkInitial(
          cfg,
          upgrades.current,
          savedLives.current,
          savedScore.current
        )}
        running={uiPhase !== 'game_over'}
        onUpdate={(ents, time) => {
          const gs = ents['gameState'];
          if (!gs) return;
          const p = prev.current;

          const sc = gs.score as number;
          const lv = gs.lives as number;
          const bh = gs.bossHp as number;
          const ep = gs.enginePhase as string;
          const f = Math.round(time.fps);

          if (sc !== p.score) {
            p.score = sc;
            savedScore.current = sc;
            setScore(sc);
          }
          if (lv !== p.lives) {
            p.lives = lv;
            savedLives.current = lv;
            setLives(lv);
          }
          if (bh !== p.bossHp) {
            p.bossHp = bh;
            setBossHp(bh);
          }
          if (f !== p.fps) {
            p.fps = f;
            setFps(f);
          }

          if (ep !== p.ep) {
            p.ep = ep;
            if (ep === 'wave_complete') onWaveComplete();
            else if (ep === 'boss_dead') onRoundComplete(sc, lv);
            else if (ep === 'game_over') setUiPhase('game_over');
          }
        }}
      />

      {/* ── HUD (always visible) ─────────────────────────────────────────── */}
      <View style={s.hud} pointerEvents="none">
        <View style={s.hudBlock}>
          <Text style={s.scoreVal}>{score.toLocaleString()}</Text>
          <Text style={s.hudLbl}>SCORE</Text>
        </View>
        <View style={s.hudBlock}>
          <Text style={s.roundVal}>ROUND {round}</Text>
          <Text style={s.fpsVal}>{fps} fps</Text>
        </View>
        <View style={s.hudBlock}>
          <Text style={s.livesVal}>
            {'♥ '.repeat(Math.max(0, lives)).trim()}
          </Text>
          <Text style={s.hudLbl}>LIVES</Text>
        </View>
      </View>

      {/* ── Boss HP bar ──────────────────────────────────────────────────── */}
      {uiPhase === 'boss' && bossMaxHp > 0 && (
        <View style={s.bossBar} pointerEvents="none">
          <Text style={s.bossLbl}>⚠ BOSS</Text>
          <View style={s.bossTrack}>
            <View
              style={[
                s.bossFill,
                {
                  width: `${Math.max(0, (bossHp / bossMaxHp) * 100)}%` as any,
                  backgroundColor:
                    bossHp / bossMaxHp > 0.6
                      ? '#ff1744'
                      : bossHp / bossMaxHp > 0.3
                      ? '#ff6d00'
                      : '#ffeb3b',
                },
              ]}
            />
          </View>
        </View>
      )}

      {/* ── Power-up selection ───────────────────────────────────────────── */}
      {uiPhase === 'powerup_select' && (
        <View style={s.overlay}>
          <Text style={s.waveClearTitle}>WAVE CLEAR!</Text>
          <Text style={s.chooseSubtitle}>Choose your power-up</Text>
          {choices.map((pu) => (
            <TouchableOpacity
              key={pu.id}
              style={s.puCard}
              onPress={() => onPickUpgrade(pu.id)}
              activeOpacity={0.8}
            >
              <Text style={s.puIcon}>{pu.icon}</Text>
              <View style={s.puInfo}>
                <Text style={s.puName}>{pu.name}</Text>
                <Text style={s.puDesc}>{pu.desc}</Text>
              </View>
              <Text style={s.puArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Round complete ───────────────────────────────────────────────── */}
      {uiPhase === 'round_complete' && (
        <View style={s.overlay} pointerEvents="none">
          <Text style={s.rcRound}>ROUND {round}</Text>
          <Text style={s.rcClear}>CLEAR!</Text>
          <Text style={s.rcScore}>{score.toLocaleString()} pts</Text>
          <Text style={s.rcHint}>Next round incoming…</Text>
        </View>
      )}

      {/* ── Game over ────────────────────────────────────────────────────── */}
      {uiPhase === 'game_over' && (
        <View style={s.overlay}>
          <Text style={s.goTitle}>GAME OVER</Text>
          <Text style={s.goScore}>{score.toLocaleString()} pts</Text>
          <Text style={s.goRound}>
            Survived {round} round{round > 1 ? 's' : ''}
          </Text>
          <TouchableOpacity style={s.btn} onPress={restart} activeOpacity={0.8}>
            <Text style={s.btnTxt}>PLAY AGAIN</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050510' },
  engine: { flex: 1 },

  // HUD
  hud: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(5,5,16,0.65)',
  },
  hudBlock: { alignItems: 'center', minWidth: 80 },
  scoreVal: {
    color: '#ffeb3b',
    fontSize: 22,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  hudLbl: { color: '#444', fontSize: 10, letterSpacing: 2, marginTop: 2 },
  roundVal: { color: '#4fc3f7', fontSize: 20, fontWeight: 'bold' },
  fpsVal: { color: '#333', fontSize: 11, marginTop: 3 },
  livesVal: { color: '#ef5350', fontSize: 18 },

  // Boss HP bar
  bossBar: {
    position: 'absolute',
    top: 108,
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  bossLbl: {
    color: '#ff1744',
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  bossTrack: {
    width: '100%',
    height: 9,
    backgroundColor: '#111128',
    borderRadius: 5,
    overflow: 'hidden',
  },
  bossFill: { height: '100%', borderRadius: 5 },

  // Shared overlay backdrop
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,5,16,0.90)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Power-up overlay
  waveClearTitle: {
    color: '#4fc3f7',
    fontSize: 44,
    fontWeight: 'bold',
    letterSpacing: 4,
  },
  chooseSubtitle: {
    color: '#666',
    fontSize: 16,
    marginTop: 8,
    marginBottom: 28,
  },
  puCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '82%',
    backgroundColor: '#0c0c22',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1a1a40',
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  puIcon: { fontSize: 30, marginRight: 16 },
  puInfo: { flex: 1 },
  puName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  puDesc: { color: '#666', fontSize: 13, marginTop: 4 },
  puArrow: { color: '#4fc3f7', fontSize: 28, marginLeft: 8 },

  // Round-complete overlay
  rcRound: {
    color: '#4fc3f7',
    fontSize: 30,
    fontWeight: 'bold',
    letterSpacing: 4,
  },
  rcClear: {
    color: '#ffeb3b',
    fontSize: 68,
    fontWeight: 'bold',
    letterSpacing: 6,
  },
  rcScore: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 16,
  },
  rcHint: { color: '#444', fontSize: 14, marginTop: 12 },

  // Game-over overlay
  goTitle: {
    color: '#ef5350',
    fontSize: 52,
    fontWeight: 'bold',
    letterSpacing: 6,
  },
  goScore: {
    color: '#ffeb3b',
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 16,
  },
  goRound: { color: '#888', fontSize: 16, marginTop: 8 },
  btn: {
    marginTop: 40,
    paddingHorizontal: 48,
    paddingVertical: 18,
    backgroundColor: '#4fc3f7',
    borderRadius: 10,
  },
  btnTxt: {
    color: '#050510',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 3,
  },
});
