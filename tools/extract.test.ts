import { expect, test } from 'claude-code/testing'
import { extract, cleanName } from './extract.js'

test('extract finds narrator and the Prophet\'s quoted words', () => {
  expect(extract('Narrated \'Test Narrator: The Prophet (ﷺ) said, "Fixture saying one."'))
    .toEqual({ narrator: 'Test Narrator', quote: 'Fixture saying one.' })
  expect(extract('Narrated Test Narrator: I heard Allah\'s Messenger (ﷺ) saying, "Fixture two." Then he left.'))
    .toEqual({ narrator: 'Test Narrator', quote: 'Fixture two.' })
})
test('extract returns null when unsure', () => {
  expect(extract('Narrated Test Narrator: He prayed two rak\'at and left.')).toBe(null)        // no quote
  expect(extract('Narrated Test Narrator: The Prophet (ﷺ) said, "Unclosed quote')).toBe(null)  // unclosed
  expect(extract('Narrated Test Narrator: A man said, "Not the Prophet."')).toBe(null)        // other speaker
  expect(extract('The Prophet (ﷺ) said, "No narrator line."')).toBe(null)                     // no narrator
})
test('cleanName gives a readable first draft', () => {
  expect(cleanName('Ar Rahmaan')).toBe('Ar-Rahman')
  expect(cleanName('Al Ghaffaar')).toBe('Al-Ghaffar')
  expect(cleanName('Al Khaaliq')).toBe('Al-Khaliq')
})
