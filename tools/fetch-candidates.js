// Pulls hadith and the 99 names from public APIs and writes tools/candidates.json
// for review in tools/review.html. Run by hand: node tools/fetch-candidates.js
import { readFile, writeFile } from 'node:fs/promises'
import { extract, cleanName } from './extract.js'

const HADITH_API = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions'
const NAMES_API = 'https://api.aladhan.com/v1/asmaAlHusna'
const MAX_QUOTE = 200
// Shorter quotes are almost always replies inside a story ("Sell it to me.")
const MIN_QUOTE = 30
const here = (file) => new URL(file, import.meta.url)

async function getJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return res.json()
}

async function collection(name, label) {
  const [eng, ara] = await Promise.all([
    getJson(`${HADITH_API}/eng-${name}.json`),
    getJson(`${HADITH_API}/ara-${name}.json`),
  ])
  const arabic = new Map(ara.hadiths.map((h) => [h.hadithnumber, h.text]))
  const kept = []
  const rejected = { 'no narrator': 0, 'no Prophet quote': 0, 'too short': 0, 'too long': 0 }
  for (const h of eng.hadiths) {
    if (!/^Narrated\s+[^:]+:/.test(h.text)) { rejected['no narrator']++; continue }
    const found = extract(h.text)
    if (!found) { rejected['no Prophet quote']++; continue }
    if (found.quote.length < MIN_QUOTE) { rejected['too short']++; continue }
    if (found.quote.length > MAX_QUOTE) { rejected['too long']++; continue }
    kept.push({
      id: `${name}-${h.hadithnumber}`,
      collection: label,
      number: String(h.hadithnumber),
      narrator: found.narrator,
      en: found.quote,
      original: h.text,
      ar: arabic.get(h.hadithnumber) ?? '',
      url: `https://sunnah.com/${name}:${h.hadithnumber}`,
    })
  }
  return { kept, rejected, total: eng.hadiths.length }
}

const [bukhari, muslim, names, zikr] = await Promise.all([
  collection('bukhari', 'Bukhari'),
  collection('muslim', 'Muslim'),
  getJson(NAMES_API),
  readFile(here('./zikr.json'), 'utf8').then(JSON.parse),
])

const candidates = {
  zikr,
  names: names.data.map((n) => ({
    number: n.number,
    en: cleanName(n.transliteration),
    meaning: n.en.meaning,
    ar: n.name,
    sourceTransliteration: n.transliteration,
  })),
  hadith: [...bukhari.kept, ...muslim.kept],
}
await writeFile(here('./candidates.json'), JSON.stringify(candidates, null, 2))

console.log(`zikr ${zikr.length}, names ${candidates.names.length}, hadith Bukhari ${bukhari.kept.length}, Muslim ${muslim.kept.length}`)
for (const [label, c] of [['Bukhari', bukhari], ['Muslim', muslim]]) {
  const why = Object.entries(c.rejected).map(([k, v]) => `${k} ${v}`).join(', ')
  console.log(`rejected ${label} (of ${c.total}): ${why}`)
}
