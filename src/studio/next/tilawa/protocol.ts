import type { Passage } from '../session'
import type { MistakeKind, ModelVariant, TilawaEvent } from '../learning/contracts'

export type Request =
  | { kind: 'load'; variant: ModelVariant }
  | { kind: 'start'; passage?: Passage }
  | { kind: 'audio'; samples: Float32Array; sampleRate: number }
  | { kind: 'stop' }
export type Reply =
  | { kind: 'loaded'; supports: MistakeKind[]; backend: string }
  | { kind: 'started'; id: string }
  | { kind: 'audio' | 'stopped'; ms: number; events: TilawaEvent[] }
export type Message =
  | { id: number; reply: Reply }
  | { id: number; error: string }
  | { progress: { stage: string; loaded: number; total: number } }
