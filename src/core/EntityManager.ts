import type { Entities, Entity, EntityId } from '../types';

let _nextId = 1;

/** Generate a unique entity ID */
export function generateEntityId(): number {
  return _nextId++;
}

/** Create a shallow copy of the entity map (for immutable update patterns) */
export function cloneEntities(entities: Entities): Entities {
  return { ...entities };
}

/** Add or replace an entity */
export function addEntity(entities: Entities, entity: Entity): Entities {
  return { ...entities, [entity.id]: entity };
}

/** Remove an entity by ID */
export function removeEntity(entities: Entities, id: EntityId): Entities {
  const next = { ...entities };
  delete next[id];
  return next;
}

/** Update a specific entity's properties (shallow merge) */
export function updateEntity(
  entities: Entities,
  id: EntityId,
  patch: Partial<Entity>
): Entities {
  const existing = entities[id];
  if (!existing) return entities;
  return { ...entities, [id]: { ...existing, ...patch } };
}

/** Get all entities that have all of the specified component keys */
export function queryEntities(
  entities: Entities,
  ...componentKeys: string[]
): Entity[] {
  return Object.values(entities).filter((e) =>
    componentKeys.every((k) => k in e)
  );
}

/** Get a single entity by ID */
export function getEntity(
  entities: Entities,
  id: EntityId
): Entity | undefined {
  return entities[id];
}

/** Convert an array of entities to the Entities map */
export function entitiesToMap(list: Entity[]): Entities {
  return list.reduce<Entities>((acc, e) => {
    acc[e.id] = e;
    return acc;
  }, {});
}
