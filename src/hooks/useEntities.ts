import { useCallback, useRef, useState } from 'react';
import {
  addEntity,
  cloneEntities,
  generateEntityId,
  removeEntity,
  updateEntity,
} from '../core/EntityManager';
import type { Entities, Entity, EntityId } from '../types';

export interface UseEntitiesReturn {
  entities: Entities;
  addEntity: (entity: Omit<Entity, 'id'> & { id?: EntityId }) => EntityId;
  removeEntity: (id: EntityId) => void;
  updateEntity: (id: EntityId, patch: Partial<Entity>) => void;
  setEntities: (entities: Entities) => void;
  resetEntities: (initial?: Entities) => void;
}

/**
 * Hook for managing game entities with stable references.
 * Uses an internal mutable ref for the hot loop path and triggers
 * a React re-render when you explicitly want one.
 */
export function useEntities(initial: Entities | (() => Entities) = {}): UseEntitiesReturn {
  const [, forceUpdate] = useState(0);
  const entitiesRef = useRef<Entities>(
    typeof initial === 'function' ? initial() : { ...initial }
  );

  const add = useCallback(
    (entity: Omit<Entity, 'id'> & { id?: EntityId }): EntityId => {
      const id = entity.id ?? generateEntityId();
      entitiesRef.current = addEntity(entitiesRef.current, { ...entity, id } as Entity);
      forceUpdate((n) => n + 1);
      return id;
    },
    []
  );

  const remove = useCallback((id: EntityId) => {
    entitiesRef.current = removeEntity(entitiesRef.current, id);
    forceUpdate((n) => n + 1);
  }, []);

  const update = useCallback((id: EntityId, patch: Partial<Entity>) => {
    entitiesRef.current = updateEntity(entitiesRef.current, id, patch);
    forceUpdate((n) => n + 1);
  }, []);

  const set = useCallback((next: Entities) => {
    entitiesRef.current = next;
    forceUpdate((n) => n + 1);
  }, []);

  const reset = useCallback(
    (next?: Entities) => {
      entitiesRef.current = next
        ? cloneEntities(next)
        : typeof initial === 'function'
          ? initial()
          : { ...initial };
      forceUpdate((n) => n + 1);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return {
    entities: entitiesRef.current,
    addEntity: add,
    removeEntity: remove,
    updateEntity: update,
    setEntities: set,
    resetEntities: reset,
  };
}
