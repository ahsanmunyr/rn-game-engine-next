package com.rngameenginenext

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import com.facebook.react.bridge.ReactApplicationContext

class RnGameEngineNextModule(reactContext: ReactApplicationContext) :
  NativeRnGameEngineNextSpec(reactContext) {

  override fun triggerHaptic(type: String) {
    val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val manager = reactApplicationContext.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
      manager.defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      reactApplicationContext.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val effect = when (type) {
        "light"   -> VibrationEffect.createOneShot(10, 80)
        "medium"  -> VibrationEffect.createOneShot(20, 128)
        "heavy"   -> VibrationEffect.createOneShot(40, 255)
        "success" -> VibrationEffect.createWaveform(longArrayOf(0, 15, 50, 15), intArrayOf(0, 200, 0, 200), -1)
        "warning" -> VibrationEffect.createWaveform(longArrayOf(0, 30, 60, 30), intArrayOf(0, 200, 0, 200), -1)
        "error"   -> VibrationEffect.createWaveform(longArrayOf(0, 50, 100, 50, 100, 50), intArrayOf(0, 255, 0, 255, 0, 255), -1)
        else      -> VibrationEffect.createOneShot(20, 128)
      }
      vibrator.vibrate(effect)
    } else {
      @Suppress("DEPRECATION")
      when (type) {
        "light"   -> vibrator.vibrate(10)
        "medium"  -> vibrator.vibrate(20)
        "heavy"   -> vibrator.vibrate(40)
        "success" -> vibrator.vibrate(longArrayOf(0, 15, 50, 15), -1)
        "warning" -> vibrator.vibrate(longArrayOf(0, 30, 60, 30), -1)
        "error"   -> vibrator.vibrate(longArrayOf(0, 50, 100, 50, 100, 50), -1)
        else      -> vibrator.vibrate(20)
      }
    }
  }

  companion object {
    const val NAME = NativeRnGameEngineNextSpec.NAME
  }
}
