export function applicationMode() {
  if (typeof location === 'undefined' || typeof location.hash !== 'string') return 'studio'
  const [first, second] = location.hash.replace(/^#[/]?/, '').split('?')[0].split('/')
  if (first === 'design-studio' || /[/]design-studio[/]?$/.test(location.pathname)) return 'studio'
  if (first === 'dev') return 'dev'
  const legacy = ['quran', 'surah', 'tafsir', 'memorize', 'revise', 'plan', 'journey', 'kids-surah', 'learner', 'review']
  if (new URLSearchParams(location.search).get('app') === 'legacy' || legacy.includes(first) ||
      (first === 'kids' && second) || (first === 'recite' && /[?&](s|feedback|assignment)=/.test(location.hash))) return 'legacy'
  return 'production'
}

export const initialMode = applicationMode()
export const isProduction = initialMode === 'production'
export const legacyUrl = '?app=legacy#/'
