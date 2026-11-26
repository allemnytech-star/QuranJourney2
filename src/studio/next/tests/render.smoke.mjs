// Render smoke test: every Next Preview screen renders (server-side) on mobile and
// desktop, with demo data, with empty data, with an open Hifz task, a page-based
// revision, a Juz revision and a storage warning — so shared changes (Chrome,
// DataBar, storage notice) cannot silently break an unrelated screen.
// Run: node src/studio/next/tests/render.smoke.mjs
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createRequire } from 'node:module'

// Test-harness only, applied before anything imports React: the preview is client-rendered,
// so its stores have no server snapshot; server rendering here reuses the client snapshot.
const ReactCjs = createRequire(import.meta.url)('react')
const useSES = ReactCjs.useSyncExternalStore
ReactCjs.useSyncExternalStore = (sub, get, server) => useSES(sub, get, server ?? get)

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const mem = new Map()
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), key: (i) => [...mem.keys()][i] ?? null, get length() { return mem.size } }
globalThis.window = globalThis
globalThis.document = { addEventListener() {}, removeEventListener() {} }
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} })

const server = await createServer({ root, configFile: false, logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false }, resolve: { alias: { '@': path.join(root, 'src') } }, oxc: { jsx: { runtime: 'automatic', importSource: 'react' } } })
const load = (p) => server.ssrLoadModule(path.join(root, p))
const { renderToString } = await import('react-dom/server')
const { createElement: h } = await import('react')
const core = await load('src/studio/next/core.tsx')
const P = await load('src/studio/next/progress.ts')
const T = await load('src/studio/next/taskNav.tsx')
const H = await load('src/studio/next/storageSafety.tsx')
const SCREENS = {
  home: ['screens/home.tsx', 'HomeDashboard'], mushaf: ['screens/mushaf.tsx', 'DigitalMushaf'], ayah: ['screens/ayah.tsx', 'AyahJourney'], map: ['screens/map.tsx', 'JourneyMap'],
  library: ['screens/library.tsx', 'Library'], kids: ['screens/kids.tsx', 'KidsHouse'], week: ['screens/week.tsx', 'WeekRoadmap'], recite: ['screens/recite.tsx', 'ReciteJourney'],
  plans: ['screens/plans.tsx', 'PlansScreen'], revision: ['screens/revision.tsx', 'RevisionScreen'], similar: ['screens/similar.tsx', 'Similarities'], rewards: ['screens/rewards.tsx', 'Rewards'],
  azkar: ['screens/azkar.tsx', 'AzkarHome'], 'azkar-list': ['screens/azkar.tsx', 'AzkarList'],
  guided: ['screens/guided.tsx', 'GuidedFeed'], settings: ['screens/settings.tsx', 'SettingsScreen'], welcome: ['screens/welcome.tsx', 'Welcome'],
}
const comps = {}
for (const [id, [file, name]] of Object.entries(SCREENS)) comps[id] = (await load(`src/studio/next/${file}`))[name]

let fail = 0
let n = 0
function render(label, screen, param, expect = []) {
  for (const device of ['mobile', 'desktop']) {
    n++
    try {
      const html = renderToString(h(core.ProtoCtx.Provider, { value: { nav: { screen, param }, go() {}, device } }, h(comps[screen])))
      for (const e of expect) if (!html.includes(e)) throw new Error(`missing ${e}`)
    } catch (e) {
      fail++
      console.log(`  FAIL ${label} · ${screen}${param ? `(${param})` : ''} · ${device}: ${String(e.message).split('\n')[0]}`)
    }
  }
}
const all = (label) => Object.keys(SCREENS).forEach((s) => render(label, s))

all('demo data')
render('hero Mushaf fixed opening', 'home', undefined, ['data-quran-book', 'data-right-page="1"', 'data-left-page="2"', 'data-opening="al-fatiha-al-baqarah"'])
P.actions.reset('empty')
all('empty data')
// Open tasks of every kind
const g = P.getPreview
const hid = P.actions.createPlan({ name: 'حفظ', type: 'hifz', customActivity: 'hifz', scope: { kind: 'pages', from: 1, to: 10 }, unit: 'page', daily: 3, days: [0, 1, 2, 3, 4, 5, 6], workload: 'moderate', targetDate: null, reminder: null, primary: true })
const rid = P.actions.createPlan({ name: 'مراجعة', type: 'revision', customActivity: 'hifz', scope: { kind: 'pages', from: 50, to: 60 }, unit: 'page', daily: 2, days: [0, 1, 2, 3, 4, 5, 6], workload: 'moderate', targetDate: null, reminder: null, primary: false })
const ht = P.planTasks(g(), g().plans.find((p) => p.id === hid), [P.today()])[0]
const rt = P.planTasks(g(), g().plans.find((p) => p.id === rid), [P.today()])[0]
T.setActiveTask(T.activeFromTask(ht))
render('hifz task open', 'ayah', undefined, ['data-hifz-task', 'الصفحات'])
render('week with tasks', 'week', undefined, ['data-start'])
render('page revision', 'revision', rt.id, ['data-revision-task', 'data-seg="p50"'])
T.setActiveTask({ kind: 'scope', planId: null, taskId: null, date: P.today(), activity: 'revision', unit: 'ayah', from: 5673, to: 6236, g0: 5673, g1: 6236, name: 'الجزء ٣٠', stepKey: T.scopeStepKey('revision', 5673, 6236), startedAt: 'x', juz: 30 })
render('juz revision', 'revision', 'scope', ['data-revision-scope'])
render('map keeps juz', 'map')
// Guided feed: start screen, a running session (cards render), and the new sections
const GS = await load('src/studio/next/learning/store.ts')
render('guided start', 'guided', undefined, ['data-guided-start', 'data-start-daily'])
GS.guided.start({ s: 67, from: 1, to: 3 }, 'daily', null)
render('guided running', 'guided', undefined, ['data-guided-feed', 'data-card="intro"', 'data-card="recall"', 'data-card="complete"', 'data-pause'])
GS.guided.setPresentation('mushaf')
render('guided Mushaf presentation', 'guided', undefined, ['data-guided-mushaf', 'data-presentation-switch', 'data-scope-progress'])
GS.guided.setPresentation('focus')
render('home resume', 'home', undefined, ['data-start-today', 'data-resume'])
GS.guided.addWeak(67, 1, [0, 2])
render('retention + mistakes', 'revision', undefined, ['data-retention', 'data-mistakes', 'data-weak-row'])
render('tilawa', 'recite', undefined, ['data-tilawa', 'data-disclaimer', 'data-research-tool'])
render('model manager', 'settings', undefined, ['data-model-state', 'data-download'])
render('Mushaf memorization entry', 'mushaf', undefined, ['data-index-memorize'])
H.quarantine('quranJourney.nextPreview.v1', 'broken')
H.safeWrite('x', 'y')
mem.set('blocked', '1')
render('storage notice', 'home', undefined, ['data-storage-notice'])
render('storage notice', 'plans', undefined, ['data-storage-notice'])

console.log(`${n - fail} of ${n} renders passed`)
await server.close()
process.exit(fail ? 1 : 0)
