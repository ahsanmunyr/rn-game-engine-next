import type { Entities, System } from '../types';

/**
 * Arcade physics — simple AABB collision detection baked in.
 * Zero external dependencies. Works for rectangular hitboxes.
 */

export interface ArcadeBody {
  x: number;
  y: number;
  width: number;
  height: number;
  velocityX?: number;
  velocityY?: number;
  /** 'dynamic' bodies move; 'static' bodies block */
  bodyType?: 'dynamic' | 'static';
  /** Optional collision group mask */
  collidesWith?: string[];
  collisionGroup?: string;
}

function aabbOverlap(a: ArcadeBody, b: ArcadeBody): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/**
 * Creates an arcade physics system that you drop into your systems array.
 *
 * @example
 * const physics = createArcadePhysicsSystem({ gravity: { x: 0, y: 0.5 } });
 * <GameEngine systems={[physics, myMovementSystem]} />
 */
export function createArcadePhysicsSystem(options: {
  gravity?: { x: number; y: number };
  onCollision?: (aId: string | number, bId: string | number) => void;
}): System {
  const gravity = options.gravity ?? { x: 0, y: 0 };

  return (entities, { time }) => {
    const dt = time.deltaSeconds;
    const bodiesWithId: Array<[string | number, ArcadeBody]> = [];

    // Collect all entities that have arcade body props
    for (const id in entities) {
      const e = entities[id];
      if (
        e &&
        typeof e.x === 'number' &&
        typeof e.y === 'number' &&
        typeof e.width === 'number' &&
        typeof e.height === 'number'
      ) {
        const body = e as unknown as ArcadeBody;
        bodiesWithId.push([id, body]);
      }
    }

    // Apply gravity + velocity to dynamic bodies
    for (const [id, body] of bodiesWithId) {
      if (body.bodyType === 'static') continue;

      const vx = (body.velocityX ?? 0) + gravity.x * dt;
      const vy = (body.velocityY ?? 0) + gravity.y * dt;
      const nx = body.x + vx * dt * 60; // normalize to 60fps units
      const ny = body.y + vy * dt * 60;

      (entities[id] as Record<string, unknown>).velocityX = vx;
      (entities[id] as Record<string, unknown>).velocityY = vy;
      (entities[id] as Record<string, unknown>).x = nx;
      (entities[id] as Record<string, unknown>).y = ny;
    }

    // CCD-inspired: check collisions after movement
    for (let i = 0; i < bodiesWithId.length; i++) {
      for (let j = i + 1; j < bodiesWithId.length; j++) {
        const pairA = bodiesWithId[i];
        const pairB = bodiesWithId[j];
        if (!pairA || !pairB) continue;
        const [idA, bodyA] = pairA;
        const [idB, bodyB] = pairB;

        if (bodyA.bodyType === 'static' && bodyB.bodyType === 'static')
          continue;

        // Entity may have been removed by an earlier system this frame
        const rawA = entities[idA];
        const rawB = entities[idB];
        if (!rawA || !rawB) continue;

        const updatedA = rawA as unknown as ArcadeBody;
        const updatedB = rawB as unknown as ArcadeBody;

        if (aabbOverlap(updatedA, updatedB)) {
          options.onCollision?.(idA, idB);

          // Resolve: push dynamic body out of static
          if (bodyB.bodyType === 'static') {
            resolveCollision(entities, idA, updatedA, updatedB);
          } else if (bodyA.bodyType === 'static') {
            resolveCollision(entities, idB, updatedB, updatedA);
          } else {
            // Both dynamic: swap velocities (elastic)
            const tmpVx = (entities[idA] as Record<string, unknown>).velocityX;
            const tmpVy = (entities[idA] as Record<string, unknown>).velocityY;
            (entities[idA] as Record<string, unknown>).velocityX = (
              entities[idB] as Record<string, unknown>
            ).velocityX;
            (entities[idA] as Record<string, unknown>).velocityY = (
              entities[idB] as Record<string, unknown>
            ).velocityY;
            (entities[idB] as Record<string, unknown>).velocityX = tmpVx;
            (entities[idB] as Record<string, unknown>).velocityY = tmpVy;
          }
        }
      }
    }

    return entities;
  };
}

function resolveCollision(
  entities: Entities,
  dynamicId: string | number,
  dynamic: ArcadeBody,
  static_: ArcadeBody
) {
  const overlapX = Math.min(
    dynamic.x + dynamic.width - static_.x,
    static_.x + static_.width - dynamic.x
  );
  const overlapY = Math.min(
    dynamic.y + dynamic.height - static_.y,
    static_.y + static_.height - dynamic.y
  );

  const e = entities[dynamicId] as Record<string, unknown>;

  if (overlapX < overlapY) {
    // Push horizontally
    if (dynamic.x < static_.x) {
      e.x = static_.x - dynamic.width;
    } else {
      e.x = static_.x + static_.width;
    }
    e.velocityX = 0;
  } else {
    // Push vertically
    if (dynamic.y < static_.y) {
      e.y = static_.y - dynamic.height;
    } else {
      e.y = static_.y + static_.height;
    }
    e.velocityY = 0;
  }
}

/**
 * Matter.js bridge — zero-config wrapper when matter-js is installed.
 * Install: yarn add matter-js @types/matter-js
 */
export function createMatterPhysicsSystem(options?: {
  gravity?: { x: number; y: number; scale?: number };
}): System {
  let Matter: any = null;

  let engine: any = null;

  try {
    Matter = require('matter-js');
  } catch {
    console.warn(
      '[rn-game-engine-next] matter-js physics requested but matter-js is not installed.\n' +
        'Install it with: yarn add matter-js @types/matter-js'
    );
  }

  return (entities, { time }) => {
    if (!Matter) return entities;

    if (!engine) {
      engine = Matter.Engine.create({
        gravity: options?.gravity ?? { x: 0, y: 1, scale: 0.001 },
      });
    }

    // Sync RN entities → Matter bodies
    for (const id in entities) {
      const e = entities[id] as Record<string, unknown>;
      if (e._matterBody) {
        const body = e._matterBody as any;
        const w = typeof e.width === 'number' ? e.width : 0;
        const h = typeof e.height === 'number' ? e.height : 0;
        (entities[id] as Record<string, unknown>).x = body.position.x - w / 2;
        (entities[id] as Record<string, unknown>).y = body.position.y - h / 2;
        (entities[id] as Record<string, unknown>).angle = body.angle;
      }
    }

    Matter.Engine.update(engine, time.delta);

    return entities;
  };
}
