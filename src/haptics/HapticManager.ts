import { Platform, Vibration } from 'react-native';
import type { HapticType } from '../types';

/**
 * Haptic feedback manager.
 *
 * Uses the native TurboModule (RnGameEngineNext) for rich haptics on iOS/Android
 * when available, falling back to Vibration API.
 *
 * For rich haptics on iOS (UIImpactFeedbackGenerator) and Android (VibrationEffect),
 * the native module included in this library provides them automatically —
 * no additional packages needed.
 */

// Vibration patterns for fallback (Android only needs these)
const PATTERNS: Record<HapticType, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 40,
  success: [0, 15, 50, 15],
  warning: [0, 30, 60, 30],
  error: [0, 50, 100, 50, 100, 50],
};

class HapticManagerClass {
  private nativeModule: { triggerHaptic: (type: string) => void } | null = null;
  private enabled = true;

  constructor() {
    this.initNativeModule();
  }

  private initNativeModule() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { TurboModuleRegistry } = require('react-native');
      const mod = TurboModuleRegistry.get('RnGameEngineNext');
      if (mod && typeof mod.triggerHaptic === 'function') {
        this.nativeModule = mod;
      }
    } catch {
      // Native module not available — use fallback
    }
  }

  trigger(type: HapticType = 'medium'): void {
    if (!this.enabled) return;

    if (this.nativeModule) {
      this.nativeModule.triggerHaptic(type);
      return;
    }

    // Fallback: Vibration API (works on Android; no-op on iOS without permission)
    if (Platform.OS === 'android') {
      const pattern = PATTERNS[type];
      if (Array.isArray(pattern)) {
        Vibration.vibrate(pattern);
      } else {
        Vibration.vibrate(pattern);
      }
    }
  }

  /** Convenience wrappers */
  light = () => this.trigger('light');
  medium = () => this.trigger('medium');
  heavy = () => this.trigger('heavy');
  success = () => this.trigger('success');
  warning = () => this.trigger('warning');
  error = () => this.trigger('error');

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

export const HapticManager = new HapticManagerClass();
