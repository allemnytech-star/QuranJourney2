import * as ort from 'onnxruntime-web/all'
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm?url'
import { createTilawa, cacheStorage, type Tilawa } from '@tilawa/core/web'
import type { EngineEvent, ReferenceAsset, TilawaSession, WordRef } from '@tilawa/core'
import refUrl from '@tilawa/core/assets/ref-v2.json?url'
import { loadHafs, SURAHS } from '../../../lib/quran'
import type { Passage } from '../session'
import type { MistakeKind, TilawaEvent } from '../learning/contracts'
import { ASSET_BASE, MODEL_CACHE, MODELS } from './models'
import { insidePassage, mapWords } from './mapping'
import type { Message, Reply, Request } from './protocol'

const categories: Record<string, MistakeKind> = {
  wrong_word: 'incorrect-word', omitted_word: 'missing-word', added_word: 'extra-word', skipped_passage: 'skipped',
}
let engine: Tilawa | undefined
let session: TilawaSession | undefined
let declared: Passage | undefined
let reference = new Map<string, string[]>()
const mappings = new Map<string, Map<number, number>>()
const post = (message: Message) => self.postMessage(message)
let queue = Promise.resolve()

async function mapLocation(ref: WordRef) {
  const { surah: s, ayah: a, word } = ref
  if (!Number.isInteger(s) || !Number.isInteger(a) || a < 1 || a > (SURAHS[s - 1]?.ayat ?? 0)) return
  const key = s + ':' + a
  const original = reference.get(key)
  if (!original) return
  let map = mappings.get(key)
  if (!map) {
    try {
      const text = (await loadHafs(s))[a - 1]
      map = text ? mapWords(original, text) : new Map()
      mappings.set(key, map)
    } catch { return }
  }
  const w = map.get(word)
  if (w !== undefined) return { s, a, w }
}

async function simplify(events: EngineEvent[]): Promise<TilawaEvent[]> {
  const output: TilawaEvent[] = []
  for (const event of events) {
    if (event.type === 'position') {
      if (event.state === 'lost') { output.push({ kind: 'lost' }); continue }
      const candidate = event.observed[0]
      const ref = event.state === 'locked' ? candidate?.word : event.state === 'ambiguous' ? event.expected ?? candidate?.word : undefined
      if (!ref) continue
      if (!insidePassage(ref.surah, ref.ayah, declared)) { output.push({ kind: 'lost' }); continue }
      const at = await mapLocation(ref)
      if (at) output.push({ ...at, kind: event.state === 'locked' ? 'word' : 'uncertain' })
    }
    if (event.type === 'checker' && categories[event.errorClass] && insidePassage(event.location.surah, event.location.ayah, declared)) {
      const at = await mapLocation(event.location)
      if (at) output.push({ ...at, kind: 'observation', id: event.id, type: categories[event.errorClass], state: event.state })
    }
  }
  return output
}

// Versioned and hashed Vite URLs keep runtime/reference downloads separate
// from user data. Model bytes use the official SDK's own integrity checks.
async function localAsset(url: string) {
  const cache = typeof caches === 'undefined' ? undefined : await caches.open(MODEL_CACHE)
  const hit = await cache?.match(url)
  if (hit) return hit
  const response = await fetch(url)
  if (!response.ok) throw new Error('Tilawa asset HTTP ' + response.status)
  if (cache) {
    const copy = response.clone()
    // Start caching without holding a second application-level buffer.
    void cache.put(url, copy).catch(() => {})
  }
  return response
}

async function run(request: Request): Promise<Reply> {
  if (request.kind === 'load') {
    const asset: ReferenceAsset = await (await localAsset(refUrl)).json()
    const wasm = await (await localAsset(wasmUrl)).arrayBuffer()
    ort.env.wasm.wasmBinary = wasm
    reference = new Map(asset.ayahs.map(({s,a,w}) => [s + ':' + a,w]))
    try { engine = await createTilawa({
      tier: MODELS[request.variant].tier, assetBase: ASSET_BASE, reference: asset,
      // Allow the bundled ORT loader to use the supplied same-origin bytes.
      wasmPaths: '',
      providers: ['wasm'], threads: 1, recordEvidence: false,
      storage: typeof caches === 'undefined' ? undefined : cacheStorage(MODEL_CACHE),
      onProgress: (p) => post({ progress: { stage: p.stage, loaded: p.loaded, total: p.total } }),
    }) } finally { ort.env.wasm.wasmBinary = undefined }
    return { kind: 'loaded', supports: engine.capabilities.supported.map((entry) => categories[entry]).filter(Boolean), backend: engine.model.backend }
  }
  if (!engine) throw new Error('model unavailable')
  if (request.kind === 'start') {
    session?.dispose()
    declared = request.passage
    session = request.passage
      ? engine.startMemorization({ surah: request.passage.s, fromAyah: request.passage.from, toAyah: request.passage.to })
      : engine.startFreeRecitation()
    return { kind: 'started', id: session.id }
  }
  if (!session) throw new Error('session unavailable')
  if (request.kind === 'audio') {
    const raw = await session.pushAudio(request.samples, request.sampleRate)
    return {kind: 'audio', ms: session.now(), events: await simplify(raw)}
  }
  const raw = await session.end()
  const ms = session.now()
  session.dispose()
  session = undefined
  return {kind: 'stopped', ms, events: await simplify(raw)}
}

self.onmessage = ({data}: MessageEvent<{ id: number; request: Request }>) => {
  queue = queue.then(async () => {
    try { post({ id: data.id, reply: await run(data.request) }) }
    catch (error) { post({ id: data.id, error: error instanceof Error ? error.message : 'Tilawa failure' }) }
  })
}
