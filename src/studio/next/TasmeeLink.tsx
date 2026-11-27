import { TOTAL_AYAT } from '../../lib/quran'
import { Icon, useProto, type Nav } from './core'
import { scopeOfCanonical, scopeSummary } from './learning/scope'

let origin: Nav | undefined
export const rememberTasmeeOrigin = (nav: Nav) => { origin = nav }
export const getTasmeeOrigin = () => origin

export type TasmeeRange = { g0: number; g1: number }

export function readTasmeeScope(param: string | undefined) {
  const match = param?.match(/^([1-9]\d*)-([1-9]\d*)$/)
  if (!match) return null
  const [g0, g1] = match.slice(1).map(Number)
  if (g0 > g1 || g1 > TOTAL_AYAT) return null
  const scope = scopeOfCanonical(g0, g1, '')
  return { ...scope, label: scopeSummary(scope).range }
}

export function TasmeeLink({ scope, children = 'سمّع', className = '' }: {
  scope?: TasmeeRange | 'weak'
  children?: React.ReactNode
  className?: string
}) {
  const { go, production } = useProto()
  if (!production) return null
  const target = scope === 'weak' ? scope : scope && (scope.g0 + '-' + scope.g1)
  return (
    <button type="button" onClick={() => go('recite', target)} className={'press inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ring-1 ring-line ' + className} data-tasmee-link>
      <Icon name="mic" size={17} />{children}
    </button>
  )
}
