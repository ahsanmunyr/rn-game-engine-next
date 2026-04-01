import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface Spec extends TurboModule {
  /**
   * Trigger haptic feedback.
   * @param type - 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error'
   */
  triggerHaptic(type: string): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('RnGameEngineNext');
