package com.rngameenginenext

import com.facebook.react.bridge.ReactApplicationContext

class RnGameEngineNextModule(reactContext: ReactApplicationContext) :
  NativeRnGameEngineNextSpec(reactContext) {

  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }

  companion object {
    const val NAME = NativeRnGameEngineNextSpec.NAME
  }
}
