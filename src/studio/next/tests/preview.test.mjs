// Regression tests for the Next Preview stores (no extra dependencies).
// Run: node src/studio/next/tests/preview.test.mjs
// Loads the real TypeScript modules through Vite's SSR loader with an in-memory
// localStorage, so nothing touches the browser or the production app.
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const mem = new Map()
// In-memory localStorage; `failWrites` simulates a full / blocked browser storage for some keys.
const failWrites = new Set()
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => {
    if (failWrites.has(k)) throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' })
    mem.set(k, String(v))
  },
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
  key: (i) => [...mem.keys()][i] ?? null,
  get length() {
    return mem.size
  },
}
globalThis.window = globalThis
globalThis.document = { addEventListener() {} }

async function fresh() {
  const server = await createServer({ root, configFile: false, logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false }, resolve: { alias: { '@': path.join(root, 'src') } } })
  const load = (p) => server.ssrLoadModule(path.join(root, p))
  return { server, load }
}
let pass = 0
const results = []
async function test(name, fn) {
  try {
    await fn()
    pass++
    results.push(`  ok   ${name}`)
  } catch (e) {
    results.push(`  FAIL ${name}\n       ${e?.stack?.split('\n').slice(0, 3).join('\n       ')}`)
    process.exitCode = 1
  }
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
const draft = (o) => ({ name: 'اختبار', type: 'hifz', customActivity: 'hifz', unit: 'ayah', daily: 5, days: ALL_DAYS, workload: 'moderate', targetDate: null, reminder: null, primary: false, ...o })

// ---------------------------------------------------------------- progress store
mem.clear()
mem.set('quranJourney.nextPreview.v1', JSON.stringify({ v: 2, seed: 'empty', plans: [], tasks: [], memorized: [], revisions: [], reading: [], lessons: [], achievements: {}, kidsBadges: {}, rewards: [], decor: 'garden', steps: {}, events: [] }))
{
  const { server, load } = await fresh()
  const P = await load('src/studio/next/progress.ts')
  const Q = await load('src/lib/quran.ts')
  const { actions: A, getPreview: G, today, planTasks, taskSegments, derived, chunksOf } = P
  const todayTask = (id) => planTasks(G(), G().plans.find((p) => p.id === id), [today()])[0]
  const markAll = (t, memorise) => taskSegments(t).forEach((s) => A.markStep(t.stepKey, s.id, memorise ? { g0: s.g0, g1: s.g1 } : undefined))

  await test('1. ayah Hifz plan: task needs confirmation and its step, then records the exact ayat', () => {
    const id = A.createPlan(draft({ scope: { kind: 'surah', s: 67, from: 1, to: 30 } }))
    const t = todayTask(id)
    assert.equal(t.state, 'open')
    assert.deepEqual([t.unit, t.from, t.to, t.g0, t.g1], ['ayah', Q.gIndex(67, 1), Q.gIndex(67, 5), Q.gIndex(67, 1), Q.gIndex(67, 5)])
    assert.equal(A.completeTask(id, today()), false, 'no confirmation')
    assert.equal(A.completeTask(id, today(), { confirmedMemorised: true }), false, 'step not confirmed')
    markAll(t, true)
    assert.equal(A.completeTask(id, today(), { confirmedMemorised: true }), true)
    assert.equal(A.completeTask(id, today(), { confirmedMemorised: true }), false, 'duplicate completion ignored')
    const rec = G().tasks.find((x) => x.planId === id)
    assert.deepEqual([rec.g0, rec.g1, rec.planVersion], [Q.gIndex(67, 1), Q.gIndex(67, 5), 1])
    assert.equal(derived(G()).memBetween(Q.gIndex(67, 1), Q.gIndex(67, 5)), 5)
  })

  await test('2. page Hifz plan: page numbers resolve through PAGES, never become ayah indices', () => {
    const id = A.createPlan(draft({ scope: { kind: 'pages', from: 1, to: 3 }, unit: 'page', daily: 2 }))
    const t = todayTask(id)
    assert.deepEqual([t.unit, t.from, t.to], ['page', 1, 2])
    const g1 = Q.gIndex(...Q.pageEnd(2))
    assert.deepEqual([t.g0, t.g1], [1, g1])
    assert.ok(g1 > 2, 'canonical end is an ayah index, not the page number')
    const segs = taskSegments(t)
    assert.ok(segs.length === 2 && segs[0].g1 === 7, 'chunks split at the Fatiha / Baqarah boundary')
    markAll(t, true)
    assert.equal(A.completeTask(id, today(), { confirmedMemorised: true }), true)
    const rec = G().tasks.find((x) => x.planId === id)
    assert.deepEqual([rec.unit, rec.from, rec.to, rec.g0, rec.g1], ['page', 1, 2, 1, g1])
    const memRec = G().memorized.find((m) => m.eventId === rec.eventId)
    assert.deepEqual([memRec.from, memRec.to], [1, g1])
    // next task continues at page 3
    const p = G().plans.find((x) => x.id === id)
    assert.equal(P.planProgress(G(), p).cursor, 3)
  })

  await test('2b. first page, last page and multi-page ranges', () => {
    assert.deepEqual(P.toCanonical('page', 1, 1), { g0: 1, g1: 7 })
    assert.deepEqual(P.toCanonical('page', 604, 604), { g0: Q.gIndex(...Q.PAGES[603]), g1: 6236 })
    const c = P.toCanonical('page', 600, 604)
    assert.equal(c.g1, 6236)
    assert.ok(new Set(chunksOf(c.g0, c.g1).map((x) => x.s)).size > 1, 'crosses surah boundaries')
    for (const x of chunksOf(c.g0, c.g1)) assert.ok(x.g1 - x.g0 + 1 <= 20 && Q.fromGIndex(x.g0)[0] === Q.fromGIndex(x.g1)[0])
  })

  await test('3. daily quota above 20 ayat: every chunk must be confirmed', () => {
    const id = A.createPlan(draft({ scope: { kind: 'surah', s: 2, from: 1, to: 286 }, daily: 100 }))
    const t = todayTask(id)
    assert.equal(t.to - t.from + 1, 100, 'quota not truncated')
    const segs = taskSegments(t)
    assert.equal(segs.length, 5)
    segs.slice(0, 4).forEach((s) => A.markStep(t.stepKey, s.id, { g0: s.g0, g1: s.g1 }))
    assert.equal(A.completeTask(id, today(), { confirmedMemorised: true }), false, '4 of 5 chunks')
    A.markStep(t.stepKey, segs[4].id, { g0: segs[4].g0, g1: segs[4].g1 })
    assert.equal(A.markStep(t.stepKey, segs[4].id), false, 'step is idempotent')
    assert.equal(A.completeTask(id, today(), { confirmedMemorised: true }), true)
    assert.equal(G().tasks.find((x) => x.planId === id).g1 - G().tasks.find((x) => x.planId === id).g0 + 1, 100)
  })

  await test('4. page-based revision: one step per page, records canonical range', () => {
    const id = A.createPlan(draft({ type: 'revision', scope: { kind: 'pages', from: 50, to: 60 }, unit: 'page', daily: 2 }))
    const t = todayTask(id)
    const segs = taskSegments(t)
    assert.deepEqual(segs.map((s) => s.page), [50, 51])
    assert.equal(A.completeTask(id, today()), false)
    A.markStep(t.stepKey, segs[0].id)
    assert.equal(A.completeTask(id, today()), false)
    A.markStep(t.stepKey, segs[1].id)
    const memBefore = derived(G()).memCount
    assert.equal(A.completeTask(id, today()), true)
    const r = G().revisions.find((x) => x.planId === id)
    assert.deepEqual([r.from, r.to], [Q.gIndex(...Q.PAGES[49]), Q.gIndex(...Q.pageEnd(51))])
    assert.equal(derived(G()).memCount, memBefore, 'revision adds no memorised ayat')
  })

  await test('5. ayah-based revision: same safeguards', () => {
    const id = A.createPlan(draft({ type: 'revision', scope: { kind: 'juz', j: 30 }, daily: 30 }))
    const t = todayTask(id)
    assert.equal(A.completeTask(id, today()), false)
    markAll(t)
    assert.equal(A.completeTask(id, today()), true)
  })

  await test('6. Juz revision from the map needs every passage, records once per day', () => {
    const g0 = Q.gIndex(...Q.JUZ[29])
    const g1 = 6236
    const key = `scope:revision:${g0}-${g1}:${today()}`
    assert.equal(A.recordRevision(`scope:${g0}-${g1}:${today()}`, g0, g1, key), false)
    P.segmentsOf('revision', 'ayah', g0, g1, g0, g1).forEach((s) => A.markStep(key, s.id))
    assert.equal(A.recordRevision(`scope:${g0}-${g1}:${today()}`, g0, g1, key), true)
    assert.equal(A.recordRevision(`scope:${g0}-${g1}:${today()}`, g0, g1, key), false)
  })

  await test('7. reading cannot be recorded without explicit read confirmation', () => {
    const id = A.createPlan(draft({ type: 'reading', scope: { kind: 'quran' }, unit: 'page', daily: 5 }))
    assert.equal(A.completeTask(id, today()), false)
    assert.equal(A.completeTask(id, today(), { confirmedRead: true }), true)
    const r = G().reading.find((x) => x.planId === id)
    assert.deepEqual([r.unit, r.from, r.to, r.g0], ['page', 1, 5, 1])
  })

  await test('8. editing a core field after progress creates a version; history unchanged', () => {
    const id = A.createPlan(draft({ scope: { kind: 'surah', s: 36, from: 1, to: 83 }, daily: 10 }))
    const t = todayTask(id)
    markAll(t, true)
    A.completeTask(id, today(), { confirmedMemorised: true })
    const before = JSON.stringify(G().tasks.filter((x) => x.planId === id))
    const ach = JSON.stringify(G().achievements)
    const p = G().plans.find((x) => x.id === id)
    const r = A.updatePlan(id, { ...p, unit: 'page', daily: 2 })
    assert.deepEqual(r, { version: 2, bumped: true })
    assert.equal(JSON.stringify(G().tasks.filter((x) => x.planId === id)), before, 'records untouched')
    assert.equal(JSON.stringify(G().achievements), ach, 'edit awards nothing')
    const np = G().plans.find((x) => x.id === id)
    assert.equal(np.versions.length, 2)
    assert.equal(np.versions[0].cfg.unit, 'ayah')
    // non-core edit: no new version
    assert.deepEqual(A.updatePlan(id, { ...np, name: 'اسم جديد' }), { version: 2, bumped: false })
  })

  await test('9. manual "completed" closes the plan and awards nothing', () => {
    const id = A.createPlan(draft({ scope: { kind: 'surah', s: 112, from: 1, to: 4 }, daily: 2 }))
    assert.ok(id)
    const before = JSON.stringify(G().achievements)
    A.setStatus(id, 'completed')
    const p = G().plans.find((x) => x.id === id)
    assert.equal(p.status, 'closed')
    assert.equal(p.verified, null)
    assert.equal(JSON.stringify(G().achievements), before)
    assert.equal(G().achievements['plan-done'], undefined)
  })

  await test('9b. reaching the target through a recorded task verifies completion', () => {
    const id = A.createPlan(draft({ scope: { kind: 'surah', s: 108, from: 1, to: 3 }, daily: 3 }))
    const t = todayTask(id)
    markAll(t, true)
    A.completeTask(id, today(), { confirmedMemorised: true })
    const p = G().plans.find((x) => x.id === id)
    assert.equal(p.status, 'completed')
    assert.ok(p.verified)
    assert.ok(G().achievements['plan-done'] && G().achievements['plan-target'])
    const n = G().rewards.filter((x) => x.ref === 'plan-done').length
    A.setStatus(id, 'active')
    A.setStatus(id, 'completed')
    assert.equal(G().rewards.filter((x) => x.ref === 'plan-done').length, n, 'no duplicate award')
  })

  await test('11. kids lesson: one star only, however often it is tapped', () => {
    const stars = derived(G()).stars
    assert.equal(A.completeLesson('surah:112'), true)
    assert.equal(A.completeLesson('surah:112'), false)
    assert.equal(derived(G()).stars, stars + 1)
  })

  await test('12. Mutashabihat contains no invented records', async () => {
    const M = await load('src/studio/next/mutashabihat.ts')
    assert.equal(M.VERIFIED_SIMILARITIES.length, 0)
  })
  await server.close()
}

// ---------------------------------------------------------------- v1 migration
await test('migration v1 → v2 repairs page numbers stored as ayah indices and keeps a backup', async () => {
  mem.clear()
  const plan = { id: 'plan-x', name: 'x', type: 'hifz', customActivity: 'hifz', scope: { kind: 'pages', from: 10, to: 20 }, unit: 'page', daily: 2, days: ALL_DAYS, workload: 'moderate', targetDate: null, reminder: null, primary: true, status: 'completed', createdAt: '2026-10-01', completedAt: '2026-10-02' }
  const v1 = { v: 1, seed: 'empty', plans: [plan], tasks: [{ id: 'plan-x:2026-10-02', planId: 'plan-x', date: '2026-10-02', at: '2026-10-02T10:00:00', activity: 'hifz', unit: 'page', from: 10, to: 11, eventId: 'task:plan-x:2026-10-02' }], memorized: [{ id: 'task:plan-x:2026-10-02', from: 10, to: 11, at: '2026-10-02T10:00:00', source: 'task', eventId: 'task:plan-x:2026-10-02' }], revisions: [], reading: [], lessons: [], achievements: { 'plan-done': { id: 'plan-done', at: 'x', eventId: 'e' } }, kidsBadges: {}, rewards: [], decor: 'garden', events: ['task:plan-x:2026-10-02'] }
  mem.set('quranJourney.nextPreview.v1', JSON.stringify(v1))
  const { server, load } = await fresh()
  const P = await load('src/studio/next/progress.ts')
  const Q = await load('src/lib/quran.ts')
  const st = P.getPreview()
  assert.equal(st.v, 2)
  const g0 = Q.gIndex(...Q.PAGES[9])
  const g1 = Q.gIndex(...Q.pageEnd(11))
  assert.deepEqual([st.memorized[0].from, st.memorized[0].to], [g0, g1])
  assert.deepEqual([st.tasks[0].from, st.tasks[0].to, st.tasks[0].g0, st.tasks[0].g1], [10, 11, g0, g1])
  assert.equal(st.plans[0].status, 'closed', 'manual v1 completion becomes an administrative close')
  assert.ok(st.achievements['plan-done'], 'earned achievements are kept')
  assert.equal(mem.get('quranJourney.nextPreview.v1.backup-before-v2'), JSON.stringify(v1))
  assert.equal(JSON.parse(mem.get('quranJourney.nextPreview.v1')).v, 2)
  await server.close()
})

// ---------------------------------------------------------------- session + active task persistence
await test('10. memorisation session and active task survive a reload', async () => {
  mem.clear()
  let { server, load } = await fresh()
  let S = await load('src/studio/next/session.tsx')
  let T = await load('src/studio/next/taskNav.tsx')
  const s0 = S.loadSession()
  S.saveSession({ ...s0, passage: { s: 2, from: 21, to: 40 }, cur: 33, mem: { '2:21': 'mastered' } })
  T.setActiveTask({ kind: 'plan', planId: 'p', taskId: 'p:2026-11-01', date: '2026-11-01', activity: 'hifz', unit: 'ayah', from: 28, to: 127, g0: 28, g1: 127, name: 'n', stepKey: 'task:p:2026-11-01:ayah:28-127', startedAt: 'x' })
  await server.close()
  ;({ server, load } = await fresh())
  S = await load('src/studio/next/session.tsx')
  T = await load('src/studio/next/taskNav.tsx')
  const s1 = S.loadSession()
  assert.deepEqual([s1.passage, s1.cur, s1.mem['2:21']], [{ s: 2, from: 21, to: 40 }, 33, 'mastered'])
  assert.equal(T.getActiveTask().g1, 127)
  // restoring records nothing
  const P = await load('src/studio/next/progress.ts')
  assert.equal(P.getPreview().events.filter((e) => e.startsWith('task:p')).length, 0)
  await server.close()
})

// ---------------------------------------------------------------- Azkar
await test('13. Azkar: counters cap, favourites, search, reset and local-midnight rollover with history', async () => {
  mem.clear()
  const y = new Date()
  y.setDate(y.getDate() - 1)
  const pad = (n) => String(n).padStart(2, '0')
  const yesterday = `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`
  const { server, load } = await fresh()
  const C = await load('src/studio/next/azkar/catalog.ts')
  const morning = C.itemsOf(C.collection('morning')).filter(C.countable)
  const one = morning.find((i) => i.count === 1)
  mem.set('quranJourney.nextPreview.azkar.v1', JSON.stringify({ v: 1, date: yesterday, counts: { [`morning:${one.id}`]: 1 }, favorites: ['hisn-1'], lastCollection: 'morning', settings: { size: 'l', compact: true }, history: {} }))
  const Z = await load('src/studio/next/azkar/store.ts')
  const { azkar, useAzkar: _u, progressOf } = Z
  // rollover at load: yesterday archived, today's counts empty, favourites / settings kept
  const raw = () => JSON.parse(mem.get('quranJourney.nextPreview.azkar.v1'))
  assert.deepEqual(raw().history[yesterday], { completed: 1, collections: ['morning'] })
  assert.deepEqual(raw().counts, {})
  assert.deepEqual(raw().favorites, ['hisn-1'])
  assert.equal(raw().settings.size, 'l')
  const multi = morning.find((i) => i.count > 1)
  for (let k = 0; k < multi.count + 5; k++) azkar.tap('morning', multi.id, multi.count)
  assert.equal(raw().counts[`morning:${multi.id}`], multi.count, 'never above the verified count')
  azkar.resetItem('morning', multi.id)
  assert.equal(raw().counts[`morning:${multi.id}`], undefined)
  azkar.tap('morning', one.id, one.count)
  assert.equal(progressOf(raw(), 'morning').done, 1)
  azkar.resetSession('morning')
  assert.equal(progressOf(raw(), 'morning').done, 0)
  azkar.toggleFavorite('hisn-1')
  assert.deepEqual(raw().favorites, [])
  azkar.toggleFavorite('hisn-2')
  assert.deepEqual(raw().favorites, ['hisn-2'])
  // Arabic search without diacritics
  const q = C.searchKey('أعوذ بكلمات الله')
  assert.ok(C.ALL_ITEMS.some((i) => C.searchKey(C.plainOf(i)).includes(q)))
  // content preserved: five non-counting instruction items, all items present
  assert.equal(C.HISN.filter((i) => i.kind === 'instruction').length, 5)
  assert.equal(C.HISN.filter((i) => i.kind === 'instruction' && C.countable(i)).length, 0)
  assert.equal(C.HISN.length, 131)
  // ch27 unmatched opening line stays out of counted items
  assert.deepEqual(C.UNMATCHED_CONTEXT, [{ chapter: 27 }])
  await server.close()
})

await test('14. only exact Quran matches are labelled exact', async () => {
  const { server, load } = await fresh()
  const C = await load('src/studio/next/azkar/catalog.ts')
  assert.match(C.QURAN_MATCH_AR('exact'), /مطابق حرفيًا/)
  for (const m of ['letters', 'partial-quote', 'mismatch']) {
    assert.doesNotMatch(C.QURAN_MATCH_AR(m), /مطابق حرفيًا/)
    assert.match(C.QURAN_MATCH_AR(m), /يحتاج مراجعة/)
  }
  assert.equal(C.STATUS_AR['source-verified'], 'مقابَل على المصدر')
  await server.close()
})


// ---------------------------------------------------------------- data safety
const KEY = 'quranJourney.nextPreview.v1'
const recoveryKeys = (k) => [...mem.keys()].filter((x) => x.startsWith(`${k}.recovery.`))

await test('S1. unreadable progress is kept aside, never overwritten silently, and reported', async () => {
  mem.clear()
  mem.set(KEY, '{"v":2, broken')
  let { server, load } = await fresh()
  let P = await load('src/studio/next/progress.ts')
  let H = await load('src/studio/next/storageSafety.tsx')
  assert.equal(P.storageStatus(), 'recovered')
  assert.equal(P.getPreview().plans.length, 0, 'starts empty, not with demo data')
  assert.equal(mem.get(KEY), '{"v":2, broken', 'original left untouched on load')
  assert.equal(recoveryKeys(KEY).length, 1)
  assert.equal(mem.get(recoveryKeys(KEY)[0]), '{"v":2, broken')
  assert.equal(H.getStorageHealth().recovered[0].key, KEY)
  await server.close()
  ;({ server, load } = await fresh())
  P = await load('src/studio/next/progress.ts')
  assert.equal(recoveryKeys(KEY).length, 1, 'reloads do not pile up copies')
  P.actions.createPlan(draft({ scope: { kind: 'surah', s: 67, from: 1, to: 30 } }))
  assert.equal(JSON.parse(mem.get(KEY)).v, 2, 'saved only after a user action')
  assert.equal(mem.get(recoveryKeys(KEY)[0]), '{"v":2, broken', 'copy still available')
  await server.close()
})

await test('S2. partially malformed data: only invalid records are left out; a full copy is kept', async () => {
  mem.clear()
  const good = { id: 'm1', from: 1, to: 7, at: '2026-10-01T10:00:00', source: 'journey', eventId: 'e1' }
  mem.set(KEY, JSON.stringify({ v: 2, seed: 'empty', tasks: [], events: ['e1'], memorized: [good, { id: 'bad', from: 'x', to: 3 }], revisions: [], reading: [], lessons: [], achievements: {}, kidsBadges: {}, rewards: [], decor: 'garden' }))
  const raw = mem.get(KEY)
  const { server, load } = await fresh()
  const P = await load('src/studio/next/progress.ts')
  const st = P.getPreview()
  assert.equal(st.memorized.length, 1)
  assert.equal(st.memorized[0].id, 'm1')
  assert.deepEqual(st.plans, [], 'missing collection defaults to empty')
  assert.equal(P.storageStatus(), 'recovered')
  assert.equal(mem.get(recoveryKeys(KEY)[0]), raw)
  await server.close()
})

await test('S3. a full / blocked storage is reported, not shown as saved', async () => {
  mem.clear()
  mem.set(KEY, JSON.stringify({ v: 2, seed: 'empty', plans: [], tasks: [], memorized: [], revisions: [], reading: [], lessons: [], achievements: {}, kidsBadges: {}, rewards: [], decor: 'garden', steps: {}, events: [] }))
  const { server, load } = await fresh()
  const P = await load('src/studio/next/progress.ts')
  const H = await load('src/studio/next/storageSafety.tsx')
  failWrites.add(KEY)
  const id = P.actions.createPlan(draft({ scope: { kind: 'surah', s: 67, from: 1, to: 30 } }))
  assert.ok(id && P.getPreview().plans.length === 1, 'kept in memory for this page')
  assert.equal(P.storageStatus(), 'unavailable')
  assert.equal(H.getStorageHealth().failed[KEY], 'quota')
  assert.equal(JSON.parse(mem.get(KEY)).plans.length, 0, 'nothing claimed as written')
  failWrites.delete(KEY)
  P.actions.setPrimary(id)
  assert.equal(P.storageStatus(), 'ok', 'recovers when storage works again')
  assert.equal(H.getStorageHealth().failed[KEY], undefined)
  await server.close()
})

await test('S4. unreadable Azkar progress and session are copied aside, not overwritten at load', async () => {
  mem.clear()
  const AK = 'quranJourney.nextPreview.azkar.v1'
  const SK = 'quranJourney.nextPreview.session.v1'
  mem.set(AK, 'oops')
  mem.set(SK, '{"v":1,"notes":')
  const { server, load } = await fresh()
  const Z = await load('src/studio/next/azkar/store.ts')
  const S = await load('src/studio/next/session.tsx')
  assert.equal(Z.azkarStorage(), 'recovered')
  assert.equal(mem.get(AK), 'oops', 'not overwritten at load')
  assert.equal(mem.get(recoveryKeys(AK)[0]), 'oops')
  S.loadSession()
  assert.equal(mem.get(recoveryKeys(SK)[0]), '{"v":1,"notes":')
  // partially valid Azkar state keeps the valid parts
  mem.clear()
  await server.close()
  const f2 = await fresh()
  mem.set(AK, JSON.stringify({ v: 1, date: '2020-01-01', counts: { 'morning:hisn-75': 1, bad: 'x' }, favorites: ['hisn-1', 5], history: { '2019-12-31': { completed: 2, collections: ['morning'] } }, settings: { size: 'xl' } }))
  const Z2 = await f2.load('src/studio/next/azkar/store.ts')
  const raw = JSON.parse(mem.get(recoveryKeys(AK)[0]))
  assert.equal(raw.counts.bad, 'x', 'full copy kept')
  assert.equal(Z2.azkarStorage(), 'recovered')
  await f2.server.close()
})

await test('S5. data saved by the ORIGINAL implementation (checkpoint 59c6301) stays readable', async () => {
  mem.clear()
  const tmp = path.join(root, 'src/studio/next/tests/.v1-progress.tmp.ts')
  const src = execFileSync('git', ['show', '59c6301:src/studio/next/progress.ts'], { cwd: root, encoding: 'utf8' })
  fs.writeFileSync(tmp, src.replace("'../../lib/quran'", "'../../../lib/quran'").replace("'../../screens/kidsData'", "'../../../screens/kidsData'"))
  try {
    let f = await fresh()
    const Old = await f.load('src/studio/next/tests/.v1-progress.tmp.ts')
    // Real v1 data, including the old bug: a page-based Hifz task stored pages as ayah indices.
    const id = Old.actions.createPlan({ name: 'قديم', type: 'hifz', customActivity: 'hifz', scope: { kind: 'pages', from: 100, to: 110 }, unit: 'page', daily: 2, days: ALL_DAYS, workload: 'moderate', targetDate: null, reminder: null, primary: false })
    assert.equal(Old.actions.completeTask(id, Old.today(), { confirmedMemorised: true }), true)
    const v1 = mem.get(KEY)
    assert.equal(JSON.parse(v1).v, 1)
    const buggy = JSON.parse(v1).memorized.find((m) => m.eventId === `task:${id}:${Old.today()}`)
    assert.deepEqual([buggy.from, buggy.to], [100, 101], 'old code stored page numbers')
    await f.server.close()
    f = await fresh()
    const P = await f.load('src/studio/next/progress.ts')
    const Q = await f.load('src/lib/quran.ts')
    const st = P.getPreview()
    assert.equal(P.storageStatus(), 'ok')
    assert.equal(st.plans.length, JSON.parse(v1).plans.length, 'all plans kept (demo + user)')
    assert.equal(st.tasks.length, JSON.parse(v1).tasks.length, 'all task records kept')
    assert.equal(st.lessons.length, JSON.parse(v1).lessons.length)
    assert.deepEqual(Object.keys(st.achievements).sort(), Object.keys(JSON.parse(v1).achievements).sort())
    const fixed = st.memorized.find((m) => m.eventId === `task:${id}:${P.today()}`)
    assert.deepEqual([fixed.from, fixed.to], [Q.gIndex(...Q.PAGES[99]), Q.gIndex(...Q.pageEnd(101))])
    assert.equal(mem.get('quranJourney.nextPreview.v1.backup-before-v2'), v1)
    // every screen-level derivation works on the upgraded data
    P.derived(st)
    for (const p of st.plans) P.planTasks(st, p, P.weekDates())
    await f.server.close()
  } finally {
    fs.rmSync(tmp, { force: true })
  }
})

// ---------------------------------------------------------------- homepage Mushaf opening
{
  const { server, load } = await fresh()
  const U = await load('src/lib/usePage.ts')
  const Q = await load('src/lib/quran.ts')
  await test('M1. hero Mushaf pages are the exact mapped opening: full Al-Fatiha, then Al-Baqarah 1–5', async () => {
    assert.deepEqual(U.pageSpans(1), [{ s: 1, from: 1, to: 7 }])
    assert.deepEqual(U.pageSpans(2), [{ s: 2, from: 1, to: 5 }])
    assert.equal(Q.hasBismillahHeader(1), false, 'Al-Fatiha ayah 1 already contains its Bismillah')
    assert.equal(Q.hasBismillahHeader(2), true)
    const right = JSON.parse(fs.readFileSync(path.join(root, 'public/quran-hafs/1.json'), 'utf8'))
    const left = JSON.parse(fs.readFileSync(path.join(root, 'public/quran-hafs/2.json'), 'utf8'))
    assert.equal(right.source.startsWith('KFGQPC Uthmanic Script HAFS'), true)
    assert.equal(left.source.startsWith('KFGQPC Uthmanic Script HAFS'), true)
    assert.equal(right.ayat.length, 7)
    assert.ok(right.ayat.every((t) => t && typeof t === 'string'))
    assert.ok(left.ayat.slice(0, 5).every((t) => t && typeof t === 'string'))
  })
  await server.close()
}

// ---------------------------------------------------------------- guided learning
{
  mem.delete('quranJourney.nextPreview.guided.v1')
  const { server, load } = await fresh()
  const S = await load('src/studio/next/learning/sequence.ts')
  const G = await load('src/studio/next/learning/store.ts')
  const MS = await load('src/studio/next/learning/scope.ts')
  const P = await load('src/studio/next/progress.ts')
  const Q = await load('src/lib/quran.ts')
  const p = { s: 67, from: 1, to: 5 }

  await test('G1. guided sequence: finite, methodology order, cumulative windows ≤ 5, one completion card', () => {
    for (const pref of ['fast', 'tadabbur', 'mastery', 'retention']) {
      const seq = S.buildSequence(p, pref)
      assert.equal(seq.at(-1).type, 'complete')
      assert.equal(seq.filter((c) => c.type === 'complete').length, 1)
      assert.equal(new Set(seq.map((c) => c.id)).size, seq.length, 'unique ids')
      for (const c of seq) assert.ok(c.from >= p.from && c.to <= p.to && c.s === 67)
      for (const c of seq.filter((c) => c.type === 'cumulative')) assert.ok(c.to - c.from + 1 <= S.CUMULATIVE_WINDOW)
    }
    const t = S.buildSequence(p, 'tadabbur').map((c) => c.type)
    assert.ok(t.indexOf('understand') < t.indexOf('listen') && t.indexOf('listen') < t.indexOf('recall'), 'understand → listen → recall')
    assert.ok(!S.buildSequence(p, 'retention').some((c) => c.type === 'intro' || c.type === 'listen'), 'retention starts with recall')
    const long = S.buildSequence({ s: 2, from: 1, to: 20 }, 'tadabbur')
    assert.ok(long.filter((c) => c.type === 'cumulative').every((c) => c.to - c.from + 1 <= 5))
  })

  await test('G2. only the stated rule reacts to outcomes: a weak-words card after a recall that needed help', () => {
    const seq = S.buildSequence(p, 'fast')
    const r = seq.find((c) => c.type === 'recall')
    assert.equal(S.followUps(seq, {}).length, seq.length)
    assert.equal(S.followUps(seq, { [r.id]: { status: 'done', recall: 'independent', at: 'x' } }).length, seq.length)
    assert.equal(S.followUps(seq, { [r.id]: { status: 'skipped', at: 'x' } }).length, seq.length, 'skipping is not an outcome')
    const f = S.followUps(seq, { [r.id]: { status: 'done', recall: 'unable', at: 'x' } })
    assert.equal(f.length, seq.length + 1)
    assert.equal(f[f.indexOf(r) + 1].type, 'weak')
  })

  await test('G3. time fitting keeps completion and never empties; summary counts only real outcomes; skipped ≠ done', () => {
    const seq = S.buildSequence(p, 'tadabbur')
    const one = S.fitToMinutes(seq, 1)
    assert.ok(one.length >= 2 && one.at(-1).type === 'complete')
    assert.ok(S.fitToMinutes(seq, 10).length < seq.length)
    const rs = seq.filter((c) => c.type === 'recall')
    const sum = S.summarize(seq, { [rs[0].id]: { status: 'done', recall: 'independent', at: 'x' }, [rs[1].id]: { status: 'done', recall: 'hints', at: 'x' }, [rs[2].id]: { status: 'skipped', at: 'x' } })
    assert.deepEqual([sum.independent, sum.hints, sum.needs, sum.practiced, sum.skipped], [[1], [2], [], 2, 1])
  })

  await test('G4. guided store: one session, idempotent outcomes, never touches memorisation; weak words recorded', () => {
    const before = JSON.stringify(P.getPreview().memorized)
    assert.equal(G.guided.start({ s: 67, from: 1, to: 25 }, 'daily'), false, 'over 20 ayat rejected')
    assert.equal(G.guided.start(p, 'daily'), true)
    const id = G.getGuided().session.id
    G.guided.record('recall:67:1-1', { status: 'done', recall: 'hints', hintsUsed: 2, revealed: [1, 3] })
    G.guided.record('recall:67:1-1', { status: 'done', recall: 'independent' })
    assert.equal(G.getGuided().session.done['recall:67:1-1'].recall, 'independent', 'later outcome replaces')
    G.guided.addWeak(67, 1, [3, 1, 1])
    assert.deepEqual(G.getGuided().weak[0].words, [1, 3])
    G.guided.pause()
    assert.ok(G.getGuided().session.pausedAt && G.getGuided().session.id === id, 'pause keeps the session')
    G.guided.finish()
    assert.ok(G.getGuided().session.finishedAt)
    assert.equal(JSON.stringify(P.getPreview().memorized), before, 'no memorisation recorded by the guided store')
    assert.equal(JSON.parse(mem.get('quranJourney.nextPreview.guided.v1')).v, 1)
  })

  await test('G5. guided store: unreadable data is quarantined, partial data keeps valid parts; self-report bounded', async () => {
    mem.set('quranJourney.nextPreview.guided.v1', '{broken')
    await server.close()
    let f = await fresh()
    let G2 = await f.load('src/studio/next/learning/store.ts')
    assert.equal(G2.getGuided().session, null)
    assert.ok([...mem.keys()].some((k) => k.startsWith('quranJourney.nextPreview.guided.v1.recovery.')), 'copy kept')
    await f.server.close()
    mem.set('quranJourney.nextPreview.guided.v1', JSON.stringify({ v: 1, profile: { preference: 'mastery', minutes: 15, selfReported: [{ s: 1, from: 1, to: 7 }, { s: 1, from: 1, to: 99 }] }, session: { passage: { s: 999, from: 1, to: 2 } }, weak: [{ s: 1, a: 1, words: [0] }, 'x'] }))
    f = await fresh()
    G2 = await f.load('src/studio/next/learning/store.ts')
    const st = G2.getGuided()
    assert.deepEqual([st.profile.preference, st.profile.minutes, st.profile.selfReported.length, st.session, st.weak.length], ['mastery', 15, 1, null, 1])
    assert.equal(G2.guided.addSelfReported({ s: 2, from: 1, to: 286 }), true, 'a whole surah may be self-reported')
    assert.equal(G2.guided.addSelfReported({ s: 2, from: 1, to: 287 }), false)
    await f.server.close()
  })

  await test('G6. a whole long Surah is preserved and chunked, never truncated to 20 ayat', () => {
    G.guided.reset()
    const kahf = MS.scopeOfSurah(18, 'mushaf')
    assert.deepEqual([kahf.g0, kahf.g1, kahf.g1 - kahf.g0 + 1], [Q.gIndex(18, 1), Q.gIndex(18, 110), 110])
    const chunks = MS.scopeChunks(kahf)
    assert.ok(chunks.length > 5)
    assert.equal(chunks[0].from, 1)
    assert.equal(chunks.at(-1).to, 110)
    assert.ok(chunks.every((c) => c.to - c.from + 1 <= 20 && c.s === 18))
    assert.equal(G.guided.startScope(kahf, 'daily', 10, 'mushaf', 'guided'), true)
    const s = G.getGuided().session
    assert.deepEqual([s.scope.g0, s.scope.g1, s.passage.from, s.passage.to, s.presentation], [kahf.g0, kahf.g1, 1, 20, 'mushaf'])
  })

  await test('G7. page ranges may cross Surah boundaries and keep exact canonical endpoints', () => {
    const scope = MS.scopeOfPages(1, 2, 'mushaf')
    assert.deepEqual(MS.scopeSummary(scope).from, { s: 1, a: 1 })
    assert.deepEqual(MS.scopeSummary(scope).to, { s: 2, a: 5 })
    const chunks = MS.scopeChunks(scope)
    assert.deepEqual(chunks.map((c) => [c.s, c.from, c.to]), [[1, 1, 7], [2, 1, 5]])
  })

  await test('G8. switching presentation changes no outcomes or memorization; chunk progress resumes', () => {
    G.guided.reset()
    const scope = MS.scopeOfSurah(18)
    G.guided.startScope(scope, 'daily', null, 'focus', 'guided')
    G.guided.record('recall:18:1-1', { status: 'done', recall: 'independent' })
    const memBefore = JSON.stringify(P.getPreview().memorized)
    G.guided.setPresentation('mushaf')
    assert.equal(G.getGuided().session.presentation, 'mushaf')
    assert.equal(G.getGuided().session.done['recall:18:1-1'].recall, 'independent')
    assert.equal(JSON.stringify(P.getPreview().memorized), memBefore)
    G.guided.setSegment(1, true)
    assert.equal(G.getGuided().session.segmentIndex, 1)
    assert.ok(G.getGuided().session.segmentResults[MS.scopeChunks(scope)[0].id])
    G.guided.setSegment(0)
    assert.equal(G.getGuided().session.done['recall:18:1-1'].recall, 'independent')
  })

  await test('G9. starting an explicit new scope archives the unfinished session instead of silently discarding it', () => {
    G.guided.reset()
    G.guided.startScope(MS.scopeOfSurah(18), 'daily')
    const old = G.getGuided().session.id
    G.guided.startScope(MS.scopeOfJuz(30), 'daily')
    assert.equal(G.getGuided().saved[0].id, old)
    assert.equal(G.getGuided().session.scope.kind, 'juz')
  })
}

console.log(results.join('\n'))
console.log(`\n${pass} passed, ${results.length - pass} failed`)
// The Azkar store keeps a midnight-rollover interval alive; end explicitly.
process.exit(process.exitCode ?? 0)
