import { expect, test } from 'claude-code/testing'
import { loadContent, wordAt, localDayNumber, hadithOfDay, randomHadith,
  hadithParts, formatDuration, spinnerParts } from './picker.js'

const H = (n: string) => ({ id: 'bukhari-' + n, collection: 'Bukhari', number: n,
  narrator: 'Test Narrator', en: 'Fixture saying ' + n + '.', url: 'https://sunnah.com/bukhari:' + n })
const RAW = { version: 1,
  zikr: [{ id: 'subhanallah', en: 'SubhanAllah', meaning: 'Glory be to Allah' }],
  names: [{ number: 1, en: 'Ar-Rahman', meaning: 'The Most Merciful' }],
  hadith: [H('1'), H('2'), H('3')] }

test('loadContent keeps good records and drops bad ones', () => {
  const c = loadContent({ ...RAW, names: [...RAW.names, { en: '', meaning: 'x' }],
    hadith: [...RAW.hadith, { id: 'x', collection: 'Tirmidhi', number: '1', narrator: 'a', en: 'b', url: 'c' }] })!
  expect(c.names.length).toBe(1)
  expect(c.hadith.length).toBe(3)        // Tirmidhi dropped: Bukhari and Muslim only
})
test('loadContent returns null for broken input', () => {
  expect(loadContent(null)).toBe(null)
  expect(loadContent({ zikr: [], names: [], hadith: [H('1')] })).toBe(null) // nothing to show in the spinner
})
test('loadContent accepts an empty hadith list', () => {
  expect(loadContent({ ...RAW, hadith: [] })!.hadith.length).toBe(0)
})
test('wordAt stays for 8 s, then moves, and word and meaning come from one entry', () => {
  const c = loadContent(RAW)!
  expect(wordAt(c, 0, 0)).toEqual({ en: 'SubhanAllah', meaning: 'Glory be to Allah' })
  expect(wordAt(c, 7999, 0).en).toBe('SubhanAllah')
  expect(wordAt(c, 8000, 0)).toEqual({ en: 'Ar-Rahman', meaning: 'The Most Merciful' })
  expect(wordAt(c, 16000, 0).en).toBe('SubhanAllah')   // wraps
  expect(wordAt(c, 0, 1).en).toBe('Ar-Rahman')         // offset shifts the start
})
test('hadithOfDay is stable within a day, moves the next day, and ignores DST', () => {
  const c = loadContent(RAW)!
  const morning = hadithOfDay(c, new Date(2026, 9, 27, 0, 5))
  expect(hadithOfDay(c, new Date(2026, 9, 27, 23, 55))).toEqual(morning)
  expect(hadithOfDay(c, new Date(2026, 9, 28, 12, 0))).not.toEqual(morning)
  expect(localDayNumber(new Date(2026, 9, 26, 1, 0)) - localDayNumber(new Date(2026, 9, 25, 23, 0))).toBe(1)
  expect(localDayNumber(new Date(2026, 2, 30, 1, 0)) - localDayNumber(new Date(2026, 2, 29, 23, 0))).toBe(1)
  expect(hadithOfDay(loadContent({ ...RAW, hadith: [] })!, new Date())).toBe(null)
})
test('randomHadith uses the given random source', () => {
  const c = loadContent(RAW)!
  expect(randomHadith(c, () => 0)!.number).toBe('1')
  expect(randomHadith(c, () => 0.99)!.number).toBe('3')
})
test('hadithParts and formatDuration', () => {
  expect(hadithParts(H('7') as any)).toEqual({ quote: '"Fixture saying 7."', source: '~ Test Narrator · Bukhari 7' })
  expect(formatDuration(0)).toBe('0s')
  expect(formatDuration(41900)).toBe('41s')
  expect(formatDuration(68000)).toBe('1m 8s')
  expect(formatDuration(3_725_000)).toBe('1h 2m')
})
test('spinnerParts honours switches, width and long lines', () => {
  const e = { en: 'Ar-Rahman', meaning: 'The Most Merciful' }
  const h = H('1') as any
  const on = { showHadith: true, showMeaning: true }
  expect(spinnerParts(e, h, on, 100)).toEqual({ suffix: ' · The Most Merciful…',
    quote: '"Fixture saying 1."', source: '~ Test Narrator · Bukhari 1' })
  expect(spinnerParts(e, h, on, 59)).toMatchObject({ quote: null, source: null })  // under 60 columns
  expect(spinnerParts(e, h, on, undefined).quote).not.toBe(null)                 // not measured: treat as wide
  expect(spinnerParts(e, h, { ...on, showMeaning: false }, 100).suffix).toBe(null)
  expect(spinnerParts(e, h, { ...on, showHadith: false }, 100)).toMatchObject({ quote: null, source: null })
  expect(spinnerParts(e, null, on, 100)).toMatchObject({ quote: null, source: null })
  const long = { en: 'La hawla wa la quwwata illa billah', meaning: 'There is no power or strength except through Allah' }
  expect(spinnerParts(long, h, on, 70).suffix).toBe(null)                        // would wrap: drop meaning
  expect(spinnerParts(long, h, on, 160).suffix).not.toBe(null)
})
test('wordAt skips words that would wrap the spinner line, and gives null when none fit', () => {
  const long = 'La hawla wa la quwwata illa billah'
  const c = loadContent({ ...RAW, zikr: [{ id: 'la-hawla', en: long, meaning: 'x' }, ...RAW.zikr] })!
  for (let t = 0; t < 6; t++) expect(wordAt(c, t * 8000, 0, 80)!.en).not.toBe(long)
  expect(wordAt(c, 0, 0, 120)!.en).toBe(long)
  expect(wordAt(c, 0, 0, 40)).toBe(null)
  expect(wordAt(c, 0, 0, undefined)!.en).toBe(long)                             // not measured: treat as wide
})
test('the spinner line leaves room for Claude Code\'s longest status', () => {
  const e = { en: "Al-Muta'ali", meaning: 'The Supreme One' }
  const status = ' (1h 5m 28s · ↓ 128.7k tokens · thinking with high effort)'
  const off = { showHadith: false, showMeaning: true }
  for (const cols of [80, 90, 100, 120, 160]) {
    const suffix = spinnerParts(e, null, off, cols).suffix ?? '…'
    expect(2 + e.en.length + suffix.length + status.length).toBeLessThanOrEqual(cols)
  }
})
