import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react'
import './next.css'
import { navigate, useRoute } from '../../lib/router'
import { Chrome, ProtoCtx, type ScreenId } from './core'
import { SessionCtx, useSessionState } from './session'
import { HomeDashboard } from './screens/home'
import { DigitalMushaf, MUSHAF_DEFAULT, MushafCtx, type MushafState } from './screens/mushaf'
import { navTo } from '../mushaf/page'
import { SURAHS, pageOf } from '../../lib/quran'
import { MUSHAF_KEY } from './productionStorage'
import { quarantine, readRaw, safeWrite } from './storageSafety'
import { useProductionAppearance } from './productionAppearance'

const screens = {
  home: HomeDashboard,
  mushaf: DigitalMushaf,
  ayah: lazy(() => import('./screens/ayah').then((m) => ({ default: m.AyahJourney }))),
  guided: lazy(() => import('./screens/guided').then((m) => ({ default: m.GuidedFeed }))),
  recite: lazy(() => import('./screens/recite').then((m) => ({ default: m.ReciteJourney }))),
  revision: lazy(() => import('./screens/revision').then((m) => ({ default: m.RevisionScreen }))),
  plans: lazy(() => import('./screens/plans').then((m) => ({ default: m.PlansScreen }))),
  week: lazy(() => import('./screens/week').then((m) => ({ default: m.WeekRoadmap }))),
  map: lazy(() => import('./screens/map').then((m) => ({ default: m.JourneyMap }))),
  library: lazy(() => import('./screens/library').then((m) => ({ default: m.Library }))),
  kids: lazy(() => import('./screens/kids').then((m) => ({ default: m.KidsHouse }))),
  rewards: lazy(() => import('./screens/rewards').then((m) => ({ default: m.Rewards }))),
  similar: lazy(() => import('./screens/similar').then((m) => ({ default: m.Similarities }))),
  azkar: lazy(() => import('./screens/azkar').then((m) => ({ default: m.AzkarHome }))),
  'azkar-list': lazy(() => import('./screens/azkar').then((m) => ({ default: m.AzkarList }))),
  settings: lazy(() => import('./screens/settings').then((m) => ({ default: m.SettingsScreen }))),
  welcome: lazy(() => import('./screens/welcome').then((m) => ({ default: m.Welcome }))),
} satisfies Record<ScreenId, React.ComponentType>

const desktop = matchMedia('(min-width: 1160px)')
function subscribe(f: () => void) {
  if (desktop.addEventListener) {
    desktop.addEventListener('change', f)
    return () => desktop.removeEventListener('change', f)
  }
  desktop.addListener(f)
  return () => desktop.removeListener(f)
}

function restoreMushaf(): MushafState {
  try {
    const saved = JSON.parse(readRaw(MUSHAF_KEY).raw ?? 'null') as MushafState | null
    if (saved?.nav && Number.isInteger(saved.nav.pg) && saved.nav.pg >= 1 && saved.nav.pg <= 604) {
      const f = saved.nav.focus
      const focus = f && Number.isInteger(f.s) && Number.isInteger(f.a) && f.a >= 1 &&
        f.a <= (SURAHS[f.s - 1]?.ayat ?? 0) && pageOf(f.s, f.a) === saved.nav.pg ? f : null
      return {
        nav: navTo(saved.nav.pg, focus),
        stage: saved.stage === 'reader' ? 'reader' : 'index',
        view: 'reading',
        tone: saved.tone === 'ivory' || saved.tone === 'sand' || saved.tone === 'night' ? saved.tone : 'app',
      }
    }
  } catch { /* Invalid bytes stay recoverable on the next write. */ }
  return { ...MUSHAF_DEFAULT, nav: navTo(1) }
}

export default function ProductionApp() {
  const { parts, q } = useRoute()
  const requested = parts[0]
  const screen = requested && Object.prototype.hasOwnProperty.call(screens, requested) ? requested as ScreenId : 'home'
  const Screen = screens[screen]
  const device = useSyncExternalStore(subscribe, () => desktop.matches) ? 'desktop' : 'mobile'
  const session = useSessionState()
  const [mushaf, setMushaf] = useState(restoreMushaf)
  const [mushafChanged, setMushafChanged] = useState(false)
  const { appearance, dark } = useProductionAppearance()
  const kids = screen === 'kids' || (screen === 'rewards' && q.target === 'kids')

  useEffect(() => {
    document.documentElement.lang = 'ar'
    document.documentElement.dir = 'rtl'
    document.title = 'القرآن رفيقي'
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = dark ? 'dark' : 'light'
    root.dataset.palette = appearance.palette
    root.toggleAttribute('data-kids', kids)
    const themeColor = getComputedStyle(root).getPropertyValue('--color-parchment').trim()
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor)
  }, [dark, appearance.palette, kids])

  const go = (next: ScreenId, param?: string) => {
    if (next !== 'ayah' && next !== 'mushaf' && next !== 'similar' && next !== 'recite' && session.s.away) session.setAway(null)
    const path = next === 'home' ? '/' : '/' + next
    navigate(param ? path + '?' + new URLSearchParams({ target: param }) : path)
  }
  const set = (patch: Partial<MushafState>) => {
    setMushafChanged(true)
    setMushaf((previous) => ({ ...previous, ...patch }))
  }
  useEffect(() => {
    if (!mushafChanged) return
    const existing = readRaw(MUSHAF_KEY).raw
    if (existing !== null) {
      try {
        const page = JSON.parse(existing)?.nav?.pg
        if (!Number.isInteger(page) || page < 1 || page > 604) throw new Error('invalid page')
      } catch {
        if (!quarantine(MUSHAF_KEY, existing)) return
      }
    }
    const value = JSON.stringify({ ...mushaf, view: 'reading' })
    if (existing !== value) safeWrite(MUSHAF_KEY, value)
  }, [mushaf, mushafChanged])

  return (
    <div className="pv-root production-app app-backdrop relative overflow-hidden text-night" dir="rtl" lang="ar"
      data-theme={dark ? 'dark' : undefined} data-palette={appearance.palette === 'garden' ? undefined : appearance.palette}
      data-kids={kids ? '' : undefined} style={{ colorScheme: dark ? 'dark' : 'light' }}>
      <SessionCtx.Provider value={session}>
        <MushafCtx.Provider value={{ s: mushaf, set }}>
          <ProtoCtx.Provider value={{ nav: { screen, param: q.target }, go, device, production: true }}>
            <Suspense fallback={<Chrome><p role="status" className="p-5">جارٍ التحميل…</p></Chrome>}>
              <Screen key={screen === 'recite' ? q.target : undefined} />
            </Suspense>
          </ProtoCtx.Provider>
        </MushafCtx.Provider>
      </SessionCtx.Provider>
    </div>
  )
}
