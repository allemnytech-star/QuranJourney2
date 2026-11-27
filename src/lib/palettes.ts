import type { Palette } from './store'

/** Colour themes. `swatch` is the [light accent, deep hero] pair used by pickers. */
export const PALETTES: { id: Palette; ar: string; en: string; swatch: [string, string] }[] = [
  { id: 'garden', ar: 'روضة', en: 'Garden', swatch: ['#3c9a63', '#24503a'] },
  { id: 'sea', ar: 'بحر', en: 'Sea', swatch: ['#3a82cc', '#1f4670'] },
  { id: 'dusk', ar: 'غسق', en: 'Dusk', swatch: ['#7a6ad6', '#352a6b'] },
  { id: 'sand', ar: 'رمال', en: 'Sand', swatch: ['#cf8644', '#6b3b1c'] },
  { id: 'rose', ar: 'ورد', en: 'Rose', swatch: ['#cc5f86', '#6a2540'] },
]
