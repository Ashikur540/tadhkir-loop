// Pure content picking and formatting. No Claude Code imports, so it is easy to test.

/** @typedef {{ en: string, meaning: string }} Entry */
/** @typedef {{ id: string, collection: 'Bukhari' | 'Muslim', number: string, narrator: string, en: string, url: string }} Hadith */
/** @typedef {{ zikr: Entry[], names: Entry[], hadith: Hadith[] }} Content */

/** How long each zikr or name stays in the spinner. */
export const ROTATE_MS = 8000

// Room left for Claude Code's own part of the spinner line, which can grow to
// " (1h 5m 28s · ↓ 128.7k tokens · thinking with high effort)". A line wider than
// the window wraps, and the fullscreen renderer then leaves stale rows behind.
const SPINNER_EXTRA = 60

// Content is printed to terminals: refuse control characters (escape sequences)
// and bidirectional overrides, which could hide or reorder text.
const UNSAFE_CHARS = /[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/
const SUNNAH_URL = /^https:\/\/sunnah\.com\//

const filled = (v) => typeof v === 'string' && v.trim() !== '' && !UNSAFE_CHARS.test(v)
const list = (v) => (Array.isArray(v) ? v : [])

const isEntry = (x) => !!x && filled(x.en) && filled(x.meaning)
const isHadith = (x) =>
  !!x && (x.collection === 'Bukhari' || x.collection === 'Muslim') &&
  ['id', 'number', 'narrator', 'en', 'url'].every((k) => filled(x[k])) &&
  SUNNAH_URL.test(x.url)

/**
 * Keeps only well-formed records.
 * @returns {Content | null} null when there is nothing to show in the spinner
 */
export function loadContent(raw) {
  if (!raw || typeof raw !== 'object') return null
  const zikr = list(raw.zikr).filter(isEntry)
  const names = list(raw.names).filter(isEntry)
  if (zikr.length + names.length === 0) return null
  return { zikr, names, hadith: list(raw.hadith).filter(isHadith) }
}

/**
 * The zikr or name to show `elapsedMs` into a turn, skipping any that would not
 * fit on one spinner line.
 * @param {number} turnOffset where this turn starts in the list
 * @param {number} [columns] the line's width; undefined means not measured, so all fit
 * @returns {Entry | null} null when none fit
 */
export function wordAt(content, elapsedMs, turnOffset, columns) {
  const pool = [...content.zikr, ...content.names]
    .filter((x) => columns === undefined || 2 + x.en.length + SPINNER_EXTRA <= columns)
  if (!pool.length) return null
  const { en, meaning } = pool[(turnOffset + Math.floor(elapsedMs / ROTATE_MS)) % pool.length]
  return { en, meaning }
}

/** Whole days from the epoch to the local calendar date, so DST can't shift it. */
export function localDayNumber(date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000
}

/**
 * The same hadith for everyone on the same local date.
 * @returns {Hadith | null}
 */
export function hadithOfDay(content, date) {
  const { hadith } = content
  return hadith.length ? hadith[localDayNumber(date) % hadith.length] : null
}

/**
 * @param {() => number} rand a source like Math.random
 * @returns {Hadith | null}
 */
export function randomHadith(content, rand) {
  const { hadith } = content
  return hadith.length ? hadith[Math.floor(rand() * hadith.length)] : null
}

/** The quoted text and its source line, e.g. `~ Abu Huraira · Bukhari 2009`. */
export function hadithParts(h) {
  return { quote: `"${h.en}"`, source: `~ ${h.narrator} · ${h.collection} ${h.number}` }
}

/** `41s`, `1m 8s` or `1h 2m`. */
export function formatDuration(ms) {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
}

/** The words that close a turn, e.g. `Alhamdulillah · 41s`. */
export function doneText(ms) {
  return 'Alhamdulillah · ' + formatDuration(ms)
}

/**
 * What surrounds the word on a spinner line.
 * @param {number} [columns] the line's width; undefined means not measured, so all fit
 * @returns {{ meaning: string | null, quote: string | null, source: string | null }}
 *   `meaning` is ` · <meaning>`, or null when switched off or too wide for the line
 */
export function spinnerParts(entry, hadith, opts, columns) {
  const meaning = ' · ' + entry.meaning
  // + 1 for the "…" the terminal puts after the meaning
  const fits = columns === undefined || 2 + entry.en.length + meaning.length + 1 + SPINNER_EXTRA <= columns
  return {
    meaning: opts.showMeaning && fits ? meaning : null,
    ...(opts.showHadith && hadith ? hadithParts(hadith) : { quote: null, source: null }),
  }
}
