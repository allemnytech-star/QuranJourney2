import { lazy, Suspense, useEffect } from 'react'
import { useRoute } from './lib/router'
import { applicationMode, initialMode } from './lib/applicationMode'
import { migrateProductionStorage } from './studio/next/productionStorage'

const Production = lazy(() => {
  migrateProductionStorage()
  return import('./studio/next/ProductionApp')
})
const Legacy = lazy(() => import('./LegacyApp'))
const Studio = lazy(() => import('./studio/Studio'))
const DevLab = lazy(() => import('./dev/DevLab'))

export default function App() {
  useRoute()
  const mode = applicationMode()
  useEffect(() => {
    if (mode !== initialMode) location.reload()
  }, [mode])
  // Store modules belong to the document's original app. A history traversal
  // across applications must load a fresh document before mounting the new one.
  if (mode !== initialMode) return null
  return (
    <Suspense fallback={<p role="status" lang="ar" dir="rtl" className="p-5">جارٍ التحميل…</p>}>
      {mode === 'legacy' ? <Legacy /> : mode === 'studio' ? <Studio /> : mode === 'dev' ? <DevLab /> : <Production />}
    </Suspense>
  )
}
