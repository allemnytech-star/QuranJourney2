import { isMark } from '../../../lib/quran'

const normalize = (word: string) => word.normalize('NFKD')
  .replace(/[\u0610-\u061a\u0640\u064b-\u065f\u0670\u06d6-\u06ed\u08d3-\u08ff]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي')

// Equal normalized character spans are required. An SDK token spanning several
// display words (or vice versa) has no single exact location and is omitted.
export function mapWords(reference: string[], ayah: string): Map<number, number> {
  let offset = 0
  const display = new Map<string, number>()
  let text = ''
  ayah.trim().split(/\s+/).forEach((token, index) => {
    const value = isMark(token) ? '' : normalize(token)
    if (!value) return
    display.set(offset + ':' + (offset + value.length), index)
    offset += value.length
    text += value
  })
  const normalized = reference.map(normalize)
  if (normalized.join('') !== text) return new Map()
  const result = new Map<number, number>()
  offset = 0
  normalized.forEach((word, index) => {
    const position = display.get(offset + ':' + (offset + word.length))
    if (position !== undefined) result.set(index + 1, position)
    offset += word.length
  })
  return result
}

export const insidePassage = (s: number, a: number, passage?: { s: number; from: number; to: number }) =>
  !passage || (s === passage.s && a >= passage.from && a <= passage.to)
