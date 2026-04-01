import type { AccelerometerData, GyroscopeData } from '../types';

type AccelCallback = (data: AccelerometerData) => void;
type GyroCallback = (data: GyroscopeData) => void;

/**
 * Optional sensor bridge. Requires the host app to install react-native-sensors:
 *   yarn add react-native-sensors
 *
 * If react-native-sensors is not installed, all methods are no-ops.
 */
export class SensorBridge {
  private accelSub: { unsubscribe: () => void } | null = null;
  private gyroSub: { unsubscribe: () => void } | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getSensors(): any | null {
    try {
      // Dynamic require so the library doesn't crash when sensors aren't installed
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require('react-native-sensors');
    } catch {
      return null;
    }
  }

  startAccelerometer(interval: number, onData: AccelCallback): void {
    const sensors = this.getSensors();
    if (!sensors) {
      console.warn(
        '[rn-game-engine-next] Accelerometer requested but react-native-sensors is not installed.'
      );
      return;
    }

    const { accelerometer, setUpdateIntervalForType, SensorTypes } = sensors;
    setUpdateIntervalForType(SensorTypes.accelerometer, interval);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.accelSub = accelerometer.subscribe(({ x, y, z, timestamp }: any) => {
      onData({ x, y, z, timestamp });
    });
  }

  stopAccelerometer(): void {
    this.accelSub?.unsubscribe();
    this.accelSub = null;
  }

  startGyroscope(interval: number, onData: GyroCallback): void {
    const sensors = this.getSensors();
    if (!sensors) {
      console.warn(
        '[rn-game-engine-next] Gyroscope requested but react-native-sensors is not installed.'
      );
      return;
    }

    const { gyroscope, setUpdateIntervalForType, SensorTypes } = sensors;
    setUpdateIntervalForType(SensorTypes.gyroscope, interval);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.gyroSub = gyroscope.subscribe(({ x, y, z, timestamp }: any) => {
      onData({ x, y, z, timestamp });
    });
  }

  stopGyroscope(): void {
    this.gyroSub?.unsubscribe();
    this.gyroSub = null;
  }

  stopAll(): void {
    this.stopAccelerometer();
    this.stopGyroscope();
  }
}
