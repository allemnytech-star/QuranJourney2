import { useSyncExternalStore } from 'react'
import { DEMO_PASSAGE } from './session'

// ---- Shared passage (both device frames, and the Mushaf's "تسميع" action, use it)
export type Passage = { s: number; from: number; to: number }
let passage: Passage = { ...DEMO_PASSAGE }
const subs = new Set<() => void>()
export const setPassage = (p: Passage) => ((passage = p), subs.forEach((f) => f()))
export const usePassage = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => passage)
/** Called from the Mushaf ayah menu: practise exactly that ayah. */
export const setReciteTarget = ({ s, a }: { s: number; a: number }) => setPassage({ s, from: a, to: a })
