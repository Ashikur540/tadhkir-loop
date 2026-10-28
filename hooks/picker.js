// Pure picking and formatting. No Claude Code imports, so it is easy to test.

/** @typedef {{ en: string, meaning: string }} Entry */
/** @typedef {{ id: string, collection: 'Bukhari' | 'Muslim', number: string, narrator: string, en: string, url: string }} Hadith */
/** @typedef {{ zikr: Entry[], names: Entry[], hadith: Hadith[] }} Content */

const ROTATE_MS = 8000
const MIN_HADITH_COLUMNS = 60
// Room left for Claude Code's own part of the spinner line, which can grow to
// " (1h 5m 28s · ↓ 128.7k tokens · thinking with high effort)". A line wider than
// the window wraps, and the fullscreen renderer then leaves stale rows behind.
const SPINNER_EXTRA = 60

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

// Only words that fit on one spinner line; null when none do
/** @returns {Entry | null} */
export function wordAt(content, elapsedMs, turnOffset, columns) {
  const pool = [...content.zikr, ...content.names]
    .filter((x) => columns === undefined || 2 + x.en.length + SPINNER_EXTRA <= columns)
  if (!pool.length) return null
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

export function hadithParts(h) {
  return { quote: `"${h.en}"`, source: `~ ${h.narrator} · ${h.collection} ${h.number}` }
}

export function formatDuration(ms) {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
}

/** @returns {{ suffix: string | null, quote: string | null, source: string | null }} */
export function spinnerParts(entry, hadith, opts, columns) {
  const wide = (need) => columns === undefined || need <= columns
  const suffix = ' · ' + entry.meaning + '…'
  const show = opts.showHadith && hadith && wide(MIN_HADITH_COLUMNS)
  return {
    suffix: opts.showMeaning && wide(2 + entry.en.length + suffix.length + SPINNER_EXTRA) ? suffix : null,
    ...(show ? hadithParts(hadith) : { quote: null, source: null }),
  }
}
