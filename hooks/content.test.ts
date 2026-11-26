import { expect, test } from 'claude-code/testing'
import raw from '../data/content.js'
import { loadContent } from './picker.js'

const repeats = (values: string[]) => values.filter((v, i) => values.indexOf(v) !== i)

test('no two of the 99 names share a spelling or a meaning', () => {
  expect(raw.names.length).toBe(99)
  expect(repeats(raw.names.map((n) => n.en.toLowerCase()))).toEqual([])
  expect(repeats(raw.names.map((n) => n.meaning.toLowerCase()))).toEqual([])
})
test('every shipped zikr, name and hadith passes the plugin\'s own checks', () => {
  // An item the checks drop would vanish quietly, and the README counts would be wrong
  const c = loadContent(raw)!
  expect([c.zikr.length, c.names.length, c.hadith.length]).toEqual([raw.zikr.length, raw.names.length, raw.hadith.length])
})
