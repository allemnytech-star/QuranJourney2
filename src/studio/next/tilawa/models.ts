import type { ModelVariant } from '../learning/contracts'

export const SDK_VERSION = '1.0.0-rc.1'
export const ORT_VERSION = '1.30.0'
export const MODEL_CACHE = 'quranJourney.tilawa.1-int8.v1'
export const ASSET_BASE = import.meta.env.VITE_TILAWA_ASSET_BASE || 'https://tilawa.dev/v1/'
export const MODELS = {
  light: { tier: 'lite', id: 'spliced-clean-lite', bytes: 24650054 },
  full: { tier: 'full', id: 'spliced-clean', bytes: 67759744 },
} as const
export const modelCacheUrl = (variant: ModelVariant) => 'https://tilawa.models/' + MODELS[variant].id + '@1-int8/model.onnx'

export function supportedDevice() {
  return typeof window !== 'undefined' && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia &&
    typeof AudioContext === 'function' && typeof AudioWorkletNode === 'function' &&
    typeof BigInt64Array === 'function' && typeof Worker === 'function' &&
    typeof WebAssembly === 'object' && WebAssembly.validate(new Uint8Array([
      // One SIMD i32x4.splat instruction in a minimal WebAssembly module.
      0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,8,1,6,0,65,0,253,17,11,
    ]))
}
