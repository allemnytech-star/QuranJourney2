/**
 * Phase 2 benchmark using the historical float32 corpus format. Keep models,
 * recordings and machine-local dependencies outside the application checkout.
 * TILAWA_BENCH_DIR contains node_modules and assets/{spliced-clean*,...}.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { cpus } from 'node:os'
import { performance } from 'node:perf_hooks'

const dir = resolve(process.env.TILAWA_BENCH_DIR ?? '../tilawa-bench')
const cases = resolve(process.env.CASES ?? join(dir, 'cases'))
const lookup = createRequire(join(dir, 'package.json'))
const pkg = lookup.resolve('@tilawa/core/package.json')
const exports = JSON.parse(await readFile(pkg, 'utf8')).exports
const { createTilawa, readWav } = await import(pathToFileURL(join(dirname(pkg), exports['./node'].import)))
const manifest = JSON.parse(await readFile(join(cases, 'manifest.json'), 'utf8'))
const results = []
for (const [tier, model] of [['lite','spliced-clean-lite'], ['full','spliced-clean']]) {
  const before = process.memoryUsage().rss
  let peak = before
  const sample = () => { peak = Math.max(peak, process.memoryUsage().rss) }
  const timer = setInterval(sample, 50)
  const t0 = performance.now()
  const tilawa = await createTilawa({ tier, modelDir: join(dir,'assets',model) })
  const initializationMs = Math.round(performance.now() - t0)
  const readyRss = process.memoryUsage().rss
  const rows = []
  try {
    for (const c of manifest) {
      let samples, sampleRate
      if (c.wav) {
        ({ samples, sampleRate } = await readWav(c.wav))
      } else {
        const b = await readFile(join(cases, c.id + '.f32'))
        samples = new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4)
        sampleRate = 16000
      }
      const session = c.free ? tilawa.startFreeRecitation() : tilawa.startMemorization({ surah: c.sura, fromAyah: c.aya_from, toAyah: c.aya_to })
      const recited = new Set()
      const transitions = new Map()
      let lockedMs = null
      const start = performance.now()
      const unsubscribe = session.subscribe((event) => {
        if (event.type === 'position' && event.state === 'locked' && event.observed[0]) {
          const p = event.observed[0].word
          recited.add(p.surah + ':' + p.ayah)
          lockedMs ??= event.timeMs
        }
        if (event.type === 'checker') {
          const row = transitions.get(event.id) ?? { kind: event.errorClass, s: event.location.surah, a: event.location.ayah, w: event.location.word, states: [] }
          if (row.states.at(-1) !== event.state) row.states.push(event.state)
          transitions.set(event.id,row)
        }
      })
      try {
        const chunk = Math.round(sampleRate * 0.32)
        for (let i = 0; i < samples.length; i += chunk) {
          await session.pushAudio(samples.subarray(i, i + chunk), sampleRate)
          sample()
        }
        await session.end()
        rows.push({id:c.id, category:c.category, audioSeconds:samples.length/sampleRate, runtimeMs:Math.round(performance.now()-start), firstLockAudioMs:lockedMs,
          expected:c.label, recited:[...recited], issues:[...transitions.values()]})
      } finally {
        unsubscribe()
        session.dispose()
      }
    }
  } finally {
    clearInterval(timer)
    await tilawa.dispose()
  }
  results.push({ tier, model, initializationMs, readyRss, peakRss: peak, beforeRss: before, releasedRss: process.memoryUsage().rss, rows })
  console.log(tier, initializationMs, peak, rows.map((r)=>[r.id, r.firstLockAudioMs, r.issues.map((e)=>e.kind+':'+e.states.at(-1))]))
}
await writeFile(join(dir,'results-v1.json'), JSON.stringify({cpu:cpus()[0]?.model, os:process.platform,node:process.version,sdk:'1.0.0-rc.1', runtime:'onnxruntime-node 1.30.0',results},null,2))
