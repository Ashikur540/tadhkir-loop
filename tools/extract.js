// Content workshop helpers. These only suggest candidates; a human approves.

const PROPHET_SAID = [
  'The Prophet (ﷺ) said',
  'the Prophet (ﷺ) said',
  "Allah's Messenger (ﷺ) said",
  "Allah's Messenger (ﷺ) saying",
  'the Messenger of Allah (ﷺ) said',
]
// How far after "said" the opening quote may start
const QUOTE_WINDOW = 40

// Returns the narrator and the Prophet's first quoted words, or null when unsure.
export function extract(text) {
  const narrated = /^Narrated\s+([^:]+):/.exec(text)
  if (!narrated) return null
  const narrator = narrated[1].trim().replace(/^['`]+/, '')

  const hits = PROPHET_SAID.map((p) => text.indexOf(p)).filter((i) => i >= 0)
  for (const at of hits.sort((a, b) => a - b)) {
    const after = at + PROPHET_SAID.find((p) => text.startsWith(p, at)).length
    const open = text.indexOf('"', after)
    if (open < 0 || open - after > QUOTE_WINDOW) continue
    const close = text.indexOf('"', open + 1)
    if (close < 0) return null
    return { narrator, quote: text.slice(open + 1, close).trim() }
  }
  return null
}

// A first-draft spelling for a name from the aladhan API. The reviewer edits it.
export function cleanName(transliteration) {
  return transliteration
    .trim()
    .replace(/^(Ash|Adh|Ath|Al|Ar|As|At|Ad|An|Az)\s+/, '$1-')
    .replace(/aa/g, 'a')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
}
