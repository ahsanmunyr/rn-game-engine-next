import type { Entities, SceneDefinition, SceneMap, System } from '../types';

export interface SceneManagerState {
  activeScene: string | null;
  entities: Entities;
  systems: System[];
}

export class SceneManager {
  private scenes: SceneMap;
  private state: SceneManagerState;

  constructor(scenes: SceneMap = {}, initialScene?: string) {
    this.scenes = scenes;
    this.state = {
      activeScene: null,
      entities: {},
      systems: [],
    };

    if (initialScene) {
      this.transitionTo(initialScene);
    }
  }

  transitionTo(sceneName: string): boolean {
    const scene = this.scenes[sceneName];
    if (!scene) {
      console.warn(`[rn-game-engine-next] Scene "${sceneName}" not found.`);
      return false;
    }

    this.state.activeScene = sceneName;
    this.state.entities =
      typeof scene.entities === 'function'
        ? scene.entities()
        : { ...scene.entities };
    this.state.systems = [...scene.systems];
    return true;
  }

  getActiveScene(): SceneDefinition | null {
    if (!this.state.activeScene) return null;
    return this.scenes[this.state.activeScene] ?? null;
  }

  getEntities(): Entities {
    return this.state.entities;
  }

  getSystems(): System[] {
    return this.state.systems;
  }

  getActiveSceneName(): string | null {
    return this.state.activeScene;
  }

  addScene(name: string, scene: SceneDefinition): void {
    this.scenes[name] = scene;
  }

  removeScene(name: string): void {
    delete this.scenes[name];
  }

  hasScene(name: string): boolean {
    return name in this.scenes;
  }
}
