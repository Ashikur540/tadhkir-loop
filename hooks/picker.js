// Pure picking and formatting. No Claude Code imports, so it is easy to test.

/** @typedef {{ en: string, meaning: string }} Entry */
/** @typedef {{ id: string, collection: 'Bukhari' | 'Muslim', number: string, narrator: string, en: string, url: string }} Hadith */
/** @typedef {{ zikr: Entry[], names: Entry[], hadith: Hadith[] }} Content */

const ROTATE_MS = 8000
const MIN_HADITH_COLUMNS = 60
// Room left for Claude Code's own "(26s · thinking)" part of the spinner line
const SPINNER_EXTRA = 30

const filled = (v) => typeof v === 'string' && v.trim() !== ''
const list = (v) => (Array.isArray(v) ? v : [])

const isEntry = (x) => !!x && filled(x.en) && filled(x.meaning)
const isHadith = (x) =>
  !!x && (x.collection === 'Bukhari' || x.collection === 'Muslim') &&
  ['id', 'number', 'narrator', 'en', 'url'].every((k) => filled(x[k]))

/** @returns {Content | null} */
export function loadContent(raw) {
  if (!raw || typeof raw !== 'object') return null
  const zikr = list(raw.zikr).filter(isEntry)
  const names = list(raw.names).filter(isEntry)
  if (zikr.length + names.length === 0) return null
  return { zikr, names, hadith: list(raw.hadith).filter(isHadith) }
}

/** @returns {Entry} */
export function wordAt(content, elapsedMs, turnOffset) {
  const pool = [...content.zikr, ...content.names]
  const { en, meaning } = pool[(turnOffset + Math.floor(elapsedMs / ROTATE_MS)) % pool.length]
  return { en, meaning }
}

// Whole days from the epoch to the local calendar date, so DST can't shift it
export function localDayNumber(date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000
}

/** @returns {Hadith | null} */
export function hadithOfDay(content, date) {
  const { hadith } = content
  return hadith.length ? hadith[localDayNumber(date) % hadith.length] : null
}

/** @returns {Hadith | null} */
export function randomHadith(content, rand) {
  const { hadith } = content
  return hadith.length ? hadith[Math.floor(rand() * hadith.length)] : null
}

export function formatHadith(h) {
  return `"${h.en}" (${h.narrator}, ${h.collection} ${h.number})`
}

export function formatDuration(ms) {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
}

/** @returns {{ suffix: string | null, hadithLine: string | null }} */
export function spinnerParts(entry, hadith, opts, columns) {
  const wide = (need) => columns === undefined || need <= columns
  const suffix = ' · ' + entry.meaning + '…'
  return {
    suffix: opts.showMeaning && wide(2 + entry.en.length + suffix.length + SPINNER_EXTRA) ? suffix : null,
    hadithLine: opts.showHadith && hadith && wide(MIN_HADITH_COLUMNS) ? '  ' + formatHadith(hadith) : null,
  }
}
