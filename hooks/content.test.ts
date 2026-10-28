import { expect, test } from 'claude-code/testing'
import raw from '../data/content.js'

const repeats = (values: string[]) => values.filter((v, i) => values.indexOf(v) !== i)

test('no two of the 99 names share a spelling or a meaning', () => {
  expect(raw.names.length).toBe(99)
  expect(repeats(raw.names.map((n) => n.en.toLowerCase()))).toEqual([])
  expect(repeats(raw.names.map((n) => n.meaning.toLowerCase()))).toEqual([])
})
