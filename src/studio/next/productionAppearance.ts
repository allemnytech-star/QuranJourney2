import { useSyncExternalStore } from 'react'
import { APPEARANCE_KEY, readAppearance, type Appearance } from './productionStorage'
import { quarantine, readRaw, safeWrite } from './storageSafety'

const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null
const saved = () => {
  const { raw } = readRaw(APPEARANCE_KEY)
  try { return readAppearance(JSON.parse(raw ?? 'null')) }
  catch {
    if (raw !== null) quarantine(APPEARANCE_KEY, raw)
    return readAppearance(null)
  }
}
let appearance: Appearance | undefined
const listeners = new Set<() => void>()
export function setProductionAppearance(patch: Partial<Appearance>) {
  appearance = { ...(appearance ?? saved()), ...patch }
  safeWrite(APPEARANCE_KEY, JSON.stringify(appearance))
  listeners.forEach((notify) => notify())
}

function subscribe(notify: () => void) {
  listeners.add(notify)
  if (media?.addEventListener) media.addEventListener('change', notify)
  else media?.addListener(notify)
  return () => {
    listeners.delete(notify)
    if (media?.removeEventListener) media.removeEventListener('change', notify)
    else media?.removeListener(notify)
  }
}

export function useProductionAppearance() {
  const preference = useSyncExternalStore(subscribe, () => appearance ??= saved(), () => readAppearance(null))
  const system = useSyncExternalStore(subscribe, () => !!media?.matches, () => false)
  return { appearance: preference, dark: preference.theme === 'dark' || (preference.theme === 'system' && system) }
}
