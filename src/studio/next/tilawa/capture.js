/* global AudioWorkletProcessor, registerProcessor, sampleRate */
class TasmeeCapture extends AudioWorkletProcessor {
  constructor() {
    super()
    this.size = Math.round(sampleRate * 0.32)
    this.buffer = new Float32Array(this.size)
    this.used = 0
    this.pending = 0
    this.finished = false
    this.port.onmessage = () => { this.pending-- }
  }

  process(inputs) {
    if (this.finished) return false
    const channel = inputs[0]?.[0]
    if (!channel) return true
    for (let i = 0; i < channel.length; i++) {
      this.buffer[this.used++] = channel[i]
      if (this.used === this.size) {
        if (this.pending >= 4) {
          this.finished = true
          this.port.postMessage({ overflow: true })
          return false
        }
        this.pending++
        this.port.postMessage({ samples: this.buffer }, [this.buffer.buffer])
        this.buffer = new Float32Array(this.size)
        this.used = 0
      }
    }
    return true
  }
}
registerProcessor('qj-tasmee-capture', TasmeeCapture)
