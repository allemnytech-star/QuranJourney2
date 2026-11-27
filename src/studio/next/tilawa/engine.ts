import { useSyncExternalStore } from 'react'
import type { MistakeKind, ModelVariant, TilawaEngine, TilawaEvent } from '../learning/contracts'
import capture from './capture.js?url'
import { MODEL_CACHE, MODELS, modelCacheUrl, supportedDevice } from './models'
import type { Message, Reply, Request } from './protocol'

type Model = 'empty' | 'downloading' | 'initializing' | 'ready' | 'failed'
type Mic = 'idle' | 'permission' | 'listening' | 'stopping'
type View = { model: Model; variant: ModelVariant; progress: number; mic: Mic; id?: string; ms: number; level: number; error?: string }
const initial: View = { model: 'empty', variant: 'light', progress: 0, mic: 'idle', ms: 0, level: 0 }
const listeners = new Set<() => void>()
let view = initial
const update = (patch: Partial<View>) => { view = { ...view, ...patch }; listeners.forEach((f) => f()) }
export const useTilawa = () => useSyncExternalStore((f) => { listeners.add(f); return () => listeners.delete(f) }, () => view, () => initial)
export const getTilawa = () => view

const errors: Record<string, string> = {
  unsupported: 'متصفحك لا يدعم التسميع الآلي على الجهاز. يمكنك التسميع يدويًا.',
  missing: 'جهّز نموذج التسميع أولًا.',
  denied: 'لم يُمنح إذن الميكروفون. يمكنك السماح به في المتصفح أو التسميع يدويًا.',
  microphone: 'تعذّر تشغيل الميكروفون. تحقّق من إعدادات الجهاز.',
  slow: 'الجهاز لم يلحق بالصوت المباشر. جرّب النموذج الخفيف أو التسميع اليدوي.',
  inference: 'توقّف محرك التسميع. أعد تجهيز النموذج أو تابع يدويًا.',
  storage: 'تعذّر حفظ النموذج. تحقّق من مساحة التخزين.',
  download: 'تعذّر تجهيز النموذج. تحقّق من الاتصال أو جرّب النموذج الخفيف.',
  integrity: 'تعذّر التحقّق من سلامة ملفات النموذج. احذف النسخة المحلية وحاول مجددًا.',
}

class BrowserTilawa implements TilawaEngine {
  supports: MistakeKind[] = []
  private worker?: Worker
  private sequence = 0
  private pending = new Map<number, { resolve: (reply: Reply) => void; reject: (error: Error) => void }>()
  private context?: AudioContext
  private stream?: MediaStream
  private source?: MediaStreamAudioSourceNode
  private node?: AudioWorkletNode
  private gain?: GainNode
  private onEvent?: (e: TilawaEvent) => void
  private permissionPending = false
  private captureReadyAt = 0

  private request(request: Request): Promise<Reply> {
    const worker = this.worker
    if (!worker) return Promise.reject(new Error('Worker unavailable'))
    const id = ++this.sequence
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      try {
        worker.postMessage({ id, request }, request.kind === 'audio' ? [request.samples.buffer] : [])
      } catch (error) {
        this.pending.delete(id)
        reject(error)
      }
    })
  }

  async load(variant: ModelVariant, onProgress: (loaded: number, total: number) => void, signal: AbortSignal) {
    if (this.permissionPending || view.mic !== 'idle' || view.model === 'downloading' || view.model === 'initializing') return
    if (!supportedDevice()) { update({ error: errors.unsupported }); return }
    if (this.worker && view.model === 'ready' && view.variant === variant) return
    await this.release()
    if (signal.aborted) return
    update({ model: 'downloading', variant, progress: 0, error: undefined })
    let worker: Worker | undefined
    const abort = () => { if (this.worker === worker) void this.release() }
    try {
      worker = new Worker(new URL('./inference.worker.ts', import.meta.url), { type: 'module' })
      this.worker = worker
      worker.onmessage = ({ data }: MessageEvent<Message>) => {
        if (this.worker !== worker) return
        if ('progress' in data) {
          const p = data.progress
          if (p.stage === 'model') {
            onProgress(p.loaded, p.total)
            update({ progress: p.total ? Math.min(1, p.loaded / p.total) : 0 })
          }
          if (p.stage === 'warmup') update({ model: 'initializing' })
          return
        }
        const pending = this.pending.get(data.id)
        this.pending.delete(data.id)
        if ('error' in data) pending?.reject(new Error(data.error))
        else pending?.resolve(data.reply)
      }
      worker.onerror = () => { if (this.worker === worker) this.fail(view.mic === 'idle' ? 'download' : 'inference') }
      signal.addEventListener('abort', abort, { once: true })
      if (signal.aborted) { abort(); return }
      const reply = await this.request({ kind: 'load', variant })
      if (reply.kind !== 'loaded') throw new Error('Unexpected load reply')
      this.supports = reply.supports
      update({ model: 'ready', progress: 1 })
    } catch (error) {
      if (!signal.aborted && (this.worker === worker || !worker)) {
        const message = error instanceof Error ? error.message : ''
        this.fail(/checksum|integrity|truncat/i.test(message) ? 'integrity' : /quota|budget|storage/i.test(message) ? 'storage' : 'download')
      }
    } finally {
      signal.removeEventListener('abort', abort)
    }
  }

  async start(opts: Parameters<TilawaEngine['start']>[0], on: (e: TilawaEvent) => void) {
    if (this.permissionPending || view.mic !== 'idle') return
    if (view.model !== 'ready' || !this.worker) { update({ error: errors.missing }); return }
    const worker = this.worker
    this.onEvent = on
    update({ mic: 'permission', id: undefined, ms: 0, level: 0, error: undefined })
    let context: AudioContext
    try {
      context = this.context = new AudioContext()
      void context.resume().catch(() => {})
      this.permissionPending = true
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
      if (this.worker !== worker || getTilawa().mic !== 'permission') {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      this.stream = stream
      for (const track of stream.getTracks()) track.onended = () => { if (this.stream === stream) this.fail('microphone') }
      await context.audioWorklet.addModule(capture)
      if (this.worker !== worker) return
      if (context.state !== 'running') await context.resume()
      if (this.worker !== worker) return
      const reply = await this.request({ kind: 'start', passage: opts.mode === 'passage' ? opts.passage : undefined })
      if (reply.kind !== 'started') throw new Error('Unexpected session reply')
      if (this.worker !== worker) return
      const source = this.source = context.createMediaStreamSource(stream)
      const node = this.node = new AudioWorkletNode(context, 'qj-tasmee-capture')
      const gain = this.gain = context.createGain()
      gain.gain.value = 0
      node.onprocessorerror = () => { if (this.node === node) this.fail('microphone') }
      node.port.onmessage = ({ data }) => {
        if (this.node !== node || this.worker !== worker) return
        if (data.overflow) { this.fail('slow'); return }
        const samples: Float32Array = data.samples
        let squared = 0
        for (const sample of samples) squared += sample * sample
        update({ ms: performance.now() - this.captureReadyAt, level: Math.min(1, Math.sqrt(squared / samples.length) * 5) })
        void this.request({ kind: 'audio', samples, sampleRate: context.sampleRate }).then((result) => {
          if (this.node === node) node.port.postMessage('ack')
          if (result.kind === 'audio' && this.worker === worker) result.events.forEach(on)
        }, () => { if (this.worker === worker) this.fail('inference') })
      }
      this.captureReadyAt = performance.now()
      update({ mic: 'listening', id: reply.id })
      source.connect(node).connect(gain).connect(context.destination)
    } catch (error) {
      if (this.worker === worker) {
        const name = error instanceof Error ? error.name : ''
        const code = name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'microphone'
        await this.closeMic()
        update({ mic: 'idle', error: errors[code] })
      }
    } finally {
      this.permissionPending = false
    }
  }

  private closeMic() {
    const { stream, context, source, node, gain } = this
    this.stream = undefined
    this.context = undefined
    this.source = undefined
    this.node = undefined
    this.gain = undefined
    if (node) { node.port.onmessage = null; node.port.close(); node.disconnect() }
    source?.disconnect()
    gain?.disconnect()
    stream?.getTracks().forEach((track) => { track.onended = null; track.stop() })
    return context && context.state !== 'closed' ? context.close().catch(() => {}) : Promise.resolve()
  }

  async stop() {
    if (view.mic === 'permission') { await this.release(); return }
    if (view.mic !== 'listening') return
    const worker = this.worker
    update({ mic: 'stopping', level: 0 })
    try {
      await this.closeMic()
      const result = await this.request({ kind: 'stop' })
      if (result.kind !== 'stopped') throw new Error('Unexpected stop reply')
      if (this.worker !== worker) return
      result.events.forEach((event) => this.onEvent?.(event))
      update({ mic: 'idle', ms: result.ms })
      this.onEvent?.({ kind: 'end' })
      this.onEvent = undefined
    } catch {
      if (this.worker === worker) this.fail('inference')
    }
  }

  private fail(code: string) {
    void this.release()
    update({ model: 'failed', error: errors[code] })
  }

  async release() {
    const closing = this.closeMic()
    this.worker?.terminate()
    this.worker = undefined
    for (const waiter of this.pending.values()) waiter.reject(new Error('Released'))
    this.pending.clear()
    this.supports = []
    this.onEvent = undefined
    update({ model: 'empty', mic: 'idle', level: 0, progress: 0, error: undefined })
    await closing
  }
}

export const tilawa = new BrowserTilawa()
let download: AbortController | undefined
export function loadTilawa(variant: ModelVariant) {
  if (download) return
  const task = download = new AbortController()
  void tilawa.load(variant, () => {}, task.signal).finally(() => { if (download === task) download = undefined })
}
export function cancelTilawa() { download?.abort() }

export async function cachedModels() {
  if (typeof caches === 'undefined') return []
  const cache = await caches.open(MODEL_CACHE)
  const keys = (await cache.keys()).map((key) => key.url)
  return (Object.keys(MODELS) as ModelVariant[]).filter((variant) => keys.includes(modelCacheUrl(variant)))
}

export async function deleteTilawa(variant: ModelVariant) {
  if (download || view.mic !== 'idle' || typeof caches === 'undefined') return
  if (view.variant === variant && view.model === 'ready') await tilawa.release()
  await (await caches.open(MODEL_CACHE)).delete(modelCacheUrl(variant))
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('pagehide', () => { cancelTilawa(); void tilawa.release() })
}
