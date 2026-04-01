import { createContext, useContext } from 'react';
import type { Entities, GameEvent, GameTime } from '../types';

export interface GameEngineContextValue {
  entities: Entities;
  dispatch: (event: GameEvent) => void;
  time: GameTime;
  running: boolean;
  stop: () => void;
  start: () => void;
}

export const GameEngineContext = createContext<GameEngineContextValue | null>(
  null
);

/**
 * Access the GameEngine context from any child component inside <GameEngine>.
 *
 * @example
 * function ScoreDisplay() {
 *   const { entities, dispatch } = useGameEngine();
 *   return <Text>{entities.score?.value}</Text>;
 * }
 */
export function useGameEngine(): GameEngineContextValue {
  const ctx = useContext(GameEngineContext);
  if (!ctx) {
    throw new Error(
      'useGameEngine must be used inside a <GameEngine> component'
    );
  }
  return ctx;
}
