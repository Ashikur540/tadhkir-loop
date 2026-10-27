# Tadhkir Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Claude Code mod that shows zikr and the 99 names (with meaning) in the spinner, one reviewed hadith under it, "Alhamdulillah" on the done line, and "Bismillah" plus a hadith of the day at startup.

**Architecture:** A plugin whose hooks module (`hooks/register.js`) wires Claude Code events to pure functions in `hooks/picker.js`. All content ships as `data/content.js`, produced by an offline workshop (`tools/`): a fetch script pulls candidates from two public APIs, and a local review page turns the owner's approvals into `content.js`.

**Tech Stack:** Claude Code mods API (2.1.299+), plain ES modules, `claude plugin test` (`claude-code/testing`), Node 18+ for the fetch script, a single vanilla HTML file for review.

**Spec:** `docs/superpowers/specs/2026-10-26-tadhkir-loop-design.md`

## Global Constraints

- Plugin name `tadhkir-loop`, display name `Tadhkir Loop`, marketplace name `tadhkir-loop`, repo `https://github.com/Ashikur540/tadhkir-loop-claude-plugin`.
- Source of truth for every mods API name and event shape: `.claude-plugin/types/claude-code/index.d.ts`, which Claude Code writes when you run `claude --plugin-dir .` once. The GitHub copy can be older. Do not commit this folder.
- Hooks module rules (from `claude plugin validate`): ES modules only; static `import` declarations from relative paths inside the plugin (only bare import allowed: `claude-code`); write every `$` call in full inline (`$.ui.log(...)`), never pass `$` to an imported function or assign it; event names as string literals.
- No runtime network calls, no reading project files, no telemetry, no third-party runtime dependencies.
- `$.clock.now()` returns a **Promise** of epoch milliseconds: always `await $.clock.now()`.
- The hadith line may wrap onto more lines in the terminal; never shorten or cut reviewed text to fit.
- Every `on(...)` gets `.catch(() => undefined)` (per the types, `undefined` from a catch handler means "hook absent", so Claude Code carries on normally).
- Fixed values: rotation `8000` ms; hide hadith below `60` columns; hadith shown text at most `200` characters; done line `✻ Alhamdulillah · <duration>`; startup line `Bismillah` + ` · Hadith of the day: <formatted hadith>`; hadith format `"<en>" (<narrator>, <collection> <number>)`.
- Shown hadith numbers and URLs are **sunnah.com** numbers.
- Only Bukhari and Muslim hadith, only human-approved items, ever ship in `data/content.js`.
- Commits carry no attribution trailers or tool footers.

## Deviations from the spec (decided while planning)

1. **`data/content.json` becomes `data/content.js`** (`export default { ... }`). Reason: `register(on, options)` has no `$`, so it can't read a file at load time, and JSON imports aren't documented for hooks modules. A static `import content from '../data/content.js'` lets `register` validate first and register nothing if the content is broken, exactly as spec section 8 wants. The review page downloads `content.js` instead of `content.json`. Same shape as spec 6.1.
2. **Main loop only.** `turn.start` and `turn.complete` also fire for subagent turns (`e.agentId` set). The mod ignores turns with `agentId` and only cancels the timer on the `turn.complete` whose `turnId` matches the main turn it started. Without this, a subagent finishing early would freeze the rotation.
3. **Long word + meaning.** If the spinner line would be too long for the terminal, the meaning is dropped and the word kept (rule in `spinnerParts`, Task 1).
4. **Hand-written zikr** ship in the first `content.js` with `ar` left empty; Arabic for zikr is filled and reviewed in Phase 2.
5. **Hadith `number` is a string**, not a number, because sunnah.com Muslim numbers can carry a letter (e.g. `2564a`).

## Review Focus

1. **A subagent runs during a turn** (Claude uses the Agent tool): the main spinner must keep rotating and the timer must not stop when the subagent's turn completes. Test in Task 2.
2. **Claude Code shows its own spinner message** (`e.props.message` is set, e.g. while compacting): the mod must leave the spinner untouched. Test in Task 2.
3. **Narrow terminal with a long zikr** ("La hawla wa la quwwata illa billah" + meaning): the meaning drops so the spinner line doesn't wrap; the word stays. Test in Task 1.
4. **Viewport not measured yet** (`e.viewport` absent): draw normally and treat as wide; never throw. Test in Task 1.
5. **Reviewer approves zero hadith or reloads the review page midway**: `content.js` with `hadith: []` must load and show zikr only; reload restores progress. Test in Task 1 (`loadContent`) and manual check in Task 5.

---

### Task 1: Pure picking and formatting (`hooks/picker.js`)

**Files:**
- Create: `hooks/picker.js`
- Test: `hooks/picker.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (all named exports of `hooks/picker.js`):
  - `type Entry = { en: string, meaning: string }`
  - `type Hadith = { id: string, collection: 'Bukhari' | 'Muslim', number: string, narrator: string, en: string, url: string }` (`number` is a string because sunnah.com Muslim numbers can carry a letter, e.g. `2564a`)
  - `type Content = { zikr: Entry[], names: Entry[], hadith: Hadith[] }`
  - `loadContent(raw: unknown): Content | null`
  - `wordAt(content: Content, elapsedMs: number, turnOffset: number): Entry`
  - `localDayNumber(date: Date): number`
  - `hadithOfDay(content: Content, date: Date): Hadith | null`
  - `randomHadith(content: Content, rand: () => number): Hadith | null`
  - `formatHadith(h: Hadith): string`
  - `formatDuration(ms: number): string`
  - `spinnerParts(entry: Entry, hadith: Hadith | null, opts: { showHadith: boolean, showMeaning: boolean }, columns: number | undefined): { suffix: string | null, hadithLine: string | null }`

- [ ] **Step 1: Write the failing tests** in `hooks/picker.test.ts`. Use a fixture built in the test file (fake text, never real hadith):

```ts
import { expect, test } from 'claude-code/testing'
import { loadContent, wordAt, localDayNumber, hadithOfDay, randomHadith,
  formatHadith, formatDuration, spinnerParts } from './picker.js'

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
test('formatHadith and formatDuration', () => {
  expect(formatHadith(H('7') as any)).toBe('"Fixture saying 7." (Test Narrator, Bukhari 7)')
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
    hadithLine: '  "Fixture saying 1." (Test Narrator, Bukhari 1)' })
  expect(spinnerParts(e, h, on, 59).hadithLine).toBe(null)                       // under 60 columns
  expect(spinnerParts(e, h, on, undefined).hadithLine).not.toBe(null)            // not measured: treat as wide
  expect(spinnerParts(e, h, { ...on, showMeaning: false }, 100).suffix).toBe(null)
  expect(spinnerParts(e, h, { ...on, showHadith: false }, 100).hadithLine).toBe(null)
  expect(spinnerParts(e, null, on, 100).hadithLine).toBe(null)
  const long = { en: 'La hawla wa la quwwata illa billah', meaning: 'There is no power or strength except with Allah' }
  expect(spinnerParts(long, h, on, 70).suffix).toBe(null)                        // would wrap: drop meaning
  expect(spinnerParts(long, h, on, 160).suffix).not.toBe(null)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `claude plugin test hooks`
Expected: FAIL, `picker.js` not found.

- [ ] **Step 3: Implement `hooks/picker.js`** with the exports above. Rules the tests don't fully pin:
  - `loadContent`: an entry is valid if `en` and `meaning` are non-empty strings; a hadith is valid if `collection` is `Bukhari` or `Muslim` and `id`, `number`, `narrator`, `en`, `url` are non-empty strings. Return `null` if `raw` isn't an object or zikr + names has no valid entry. Pool order is zikr first, then names.
  - `wordAt`: index `(turnOffset + Math.floor(elapsedMs / 8000)) % pool.length`.
  - `localDayNumber`: `Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000`.
  - `formatDuration`: whole seconds (floor). Under 60 s `Ns`, under 60 min `Nm Ss`, else `Nh Mm`.
  - `spinnerParts`: `suffix` is `' · ' + meaning + '…'` when Show meaning is on and `columns` is undefined or `2 + en.length + suffix.length + 30 <= columns` (30 leaves room for Claude Code's `(26s · thinking)` part); else `null`. `hadithLine` is `'  ' + formatHadith(h)` when Show hadith is on, `h` exists, and `columns` is undefined or at least 60.

- [ ] **Step 4: Run to verify it passes**

Run: `claude plugin test hooks`
Expected: all `picker.test.ts` tests pass.

- [ ] **Step 5: Commit**

```bash
git add hooks/picker.js hooks/picker.test.ts
git commit -m "Add picker: content loading, word rotation, hadith choice, formatting"
```

---

### Task 2: The mod, plugin files and starter content

**Files:**
- Create: `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `hooks/hooks.json`, `hooks/register.js`, `data/content.js`, `.gitignore`
- Test: `hooks/register.test.ts`

**Interfaces:**
- Consumes: everything Task 1 produces.
- Produces: `export function register(on, options)` in `hooks/register.js`; `data/content.js` default export in the spec 6.1 shape (with `number` as a string).

- [ ] **Step 1: Create the plugin files.**
  - `plugin.json`: `name` `tadhkir-loop`, `displayName` `Tadhkir Loop`, `version` `0.1.0`, `description` "Zikr, the 99 names of Allah and authentic hadith in Claude Code's spinner while Claude works.", `author` `{ "name": "Ashikur540" }`, `repository` the repo URL, and `userConfig`:
    - `show_hadith`: boolean, title `Show hadith`, description `Show a short hadith under the spinner and at startup`, default `true`
    - `show_meaning`: boolean, title `Show meaning`, description `Show the meaning after the zikr or name in the spinner`, default `true`
  - `marketplace.json`: marketplace `name` `tadhkir-loop`, owner `{ "name": "Ashikur540" }`, one plugin `tadhkir-loop` with `source` `"./"`. Check the exact schema against the marketplace reference (`https://code.claude.com/docs/en/plugins/marketplace-reference.md`).
  - `hooks/hooks.json`: `{ "description": "Tadhkir Loop hooks module", "modules": ["./register.js"] }`
  - `.gitignore`: `.claude-plugin/types/`, `tools/candidates.json`
  - `data/content.js`: `export default { version: 1, zikr: [...], names: [], hadith: [] }` with these 12 zikr (`id`, `en`, `meaning`, `ar: ""`):

| id | en | meaning |
|---|---|---|
| subhanallah | SubhanAllah | Glory be to Allah |
| alhamdulillah | Alhamdulillah | All praise is for Allah |
| allahu-akbar | Allahu Akbar | Allah is the Greatest |
| la-ilaha-illallah | La ilaha illallah | There is no deity worthy of worship except Allah |
| astaghfirullah | Astaghfirullah | I seek Allah's forgiveness |
| subhanallahi-wa-bihamdihi | SubhanAllahi wa bihamdihi | Glory be to Allah and praise be to Him |
| subhanallahil-azim | SubhanAllahil Azim | Glory be to Allah, the Magnificent |
| la-hawla | La hawla wa la quwwata illa billah | There is no power or strength except through Allah |
| hasbunallah | HasbunAllahu wa ni'mal wakil | Allah is sufficient for us, and He is the best Disposer of affairs |
| salawat | Allahumma salli ala Muhammad | O Allah, send blessings upon Muhammad |
| bismillah | Bismillah | In the name of Allah |
| rabbi-zidni-ilma | Rabbi zidni ilma | My Lord, increase me in knowledge |

  Then run `claude --plugin-dir .` once and quit, so Claude Code writes `.claude-plugin/types/`. Check the event field names used below against it.

- [ ] **Step 2: Write the failing tests** in `hooks/register.test.ts`. The `ui.render` stub stands in for Claude Code's spinner and prints the props our hook passed on:

```ts
import { expect, mock, test } from 'claude-code/testing'

const SPINNER = { plugin: 'tadhkir-loop', component: 'Spinner', requestId: 'main', surface: 'terminal',
  viewport: { columns: 100, rows: 30 }, props: { word: 'Baking', message: null, suffix: '…', mode: 'thinking' } } as const
const stubs = (on: any, seen: string[]) => {
  on('ui.render', ($: any, e: any) => { seen.push(e.props.word); return { type: 'Text', props: {}, children: [e.props.word + '|' + e.props.suffix] } })
  on('turn.start', ($: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
}
const done = (turnId: string) => ({ turnId, answer: '', durationMs: 1000, isAborted: false, usage: null })

test('spinner shows a zikr word with its meaning and rotates every 8 s', async ($, on) => {
  const seen: string[] = []; const clock = mock.clock(on); stubs(on, seen)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  const ui = await $.ui.mount(SPINNER)
  const first = seen.at(-1)
  expect(first).not.toBe('Baking')
  expect(await ui.find({ type: 'Text', text: /\| · .+…$/ })).toBeDefined()
  await clock.advance(8000)
  expect(seen.at(-1)).not.toBe(first)
})
test('no redraws after the main turn completes', async ($, on) => {
  const seen: string[] = []; const clock = mock.clock(on); stubs(on, seen)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.ui.mount(SPINNER)
  await $.turn.complete(done('t1'))
  const count = seen.length
  await clock.advance(24000)
  expect(seen.length).toBe(count)
})
test('a subagent turn does not stop the main rotation', async ($, on) => {
  const seen: string[] = []; const clock = mock.clock(on); stubs(on, seen)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.turn.start({ text: 'task', turnId: 's1', agentId: 'agent-1' })
  await $.ui.mount(SPINNER)
  await $.turn.complete(done('s1'))
  const count = seen.length
  await clock.advance(8000)
  expect(seen.length).toBeGreaterThan(count)
})
test('Claude Code status messages pass through untouched', async ($, on) => {
  const seen: string[] = []; mock.clock(on); stubs(on, seen)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.ui.mount({ ...SPINNER, props: { ...SPINNER.props, message: 'Compacting conversation' } })
  expect(seen.at(-1)).toBe('Baking')
})
test('done line reads Alhamdulillah with the duration', async ($, on) => {
  mock.clock(on)
  const ui = await $.ui.mount({ plugin: 'tadhkir-loop', component: 'TurnDuration', requestId: 'm1', surface: 'terminal',
    viewport: { columns: 100, rows: 30 }, props: { word: 'Baked', durationMs: 41000 } })
  expect(await ui.find({ type: 'Text', text: '✻ Alhamdulillah · 41s' })).toBeDefined()
})
test('session start logs one Bismillah line', async ($, on) => {
  const logs: string[] = []; mock.clock(on)
  on('session.start', () => ({ cwd: '/work' }))
  on('ui.log', ($: any, e: any) => { logs.push(e.text); return { value: undefined } })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  expect(logs.length).toBe(1)
  expect(logs[0]).toMatch(/^Bismillah( · Hadith of the day: ".+" \(.+, (Bukhari|Muslim) \S+\))?$/)
})
```

  If the mount handle does not redraw on `$.ui.invalidate` in the test kit, count invalidations instead with `on('ui.invalidate', () => { n++; return { value: undefined } })` and assert on `n`. Keep the meaning of each test.

- [ ] **Step 3: Run to verify it fails**

Run: `claude plugin test`
Expected: the `register.test.ts` tests FAIL (no hooks registered yet); `picker.test.ts` still passes.

- [ ] **Step 4: Implement `hooks/register.js`.**
  - Top: `import raw from '../data/content.js'` and the picker imports; `const CONTENT = loadContent(raw)`.
  - Module state: `mainTurnId`, `turnStart`, `turnOffset`, `turnHadith`, `timer`.
  - `register(on, options)`: return at once if `CONTENT` is `null`. `opts = { showHadith: options?.show_hadith !== false, showMeaning: options?.show_meaning !== false }`.
  - `turn.start`: if `e.agentId`, `return next(e)`. Else `timer?.cancel()`, set `mainTurnId = e.turnId`, `turnStart = await $.clock.now()`, `turnOffset = Math.floor(Math.random() * poolLength)`, `turnHadith = randomHadith(CONTENT, Math.random)`, `timer = $.clock.every(8000, () => { if (mainTurnId) $.ui.invalidate('ui.render') })`, `return next(e)`.
  - `turn.complete`: only when `e.turnId === mainTurnId`: `mainTurnId = null`, `timer?.cancel()`, `timer = null`. Always `return next(e)`.
  - `session.end`: same cleanup, `return next(e)`.
  - `ui.render` `{ component: 'Spinner' }`: if `e.props.message` is set, `return next(e)`. Else `entry = wordAt(CONTENT, (await $.clock.now()) - turnStart, turnOffset)`, `parts = spinnerParts(entry, turnHadith, opts, e.viewport?.columns)`, `theirs = await next({ ...e, props: { ...e.props, word: entry.en, ...(parts.suffix ? { suffix: parts.suffix } : {}) } })`. Return `theirs` alone if no `hadithLine`, else `Box({ flexDirection: 'column', children: [theirs, Text({ dimColor: true, children: [parts.hadithLine] })] })` from `$.ui.resolve(e)`.
  - `ui.render` `{ component: 'TurnDuration' }`: return `Text({ dimColor: true, children: ['✻ Alhamdulillah · ' + formatDuration(e.props.durationMs)] })`.
  - `session.start`: `h = opts.showHadith ? hadithOfDay(CONTENT, new Date(await $.clock.now())) : null`; `$.ui.log('Bismillah' + (h ? ' · Hadith of the day: ' + formatHadith(h) : ''))`; `return next(e)`.
  - Every `on(...)` ends with `.catch(() => undefined)`.

- [ ] **Step 5: Run tests and validation**

Run: `claude plugin test && claude plugin validate .`
Expected: all tests pass; `✔ Validation passed`, with the hooks line listing `session.start, session.end, turn.start, turn.complete, ui.render{component=Spinner}, ui.render{component=TurnDuration}`. README/LICENSE directory warnings are fixed in Task 6.

- [ ] **Step 6: Manual check in the terminal.** Run `claude --plugin-dir .` and send: `Think carefully, then write a detailed 800-word essay on why small, consistent good habits matter for a programmer. Do not use any tools and do not edit any files.` Expect: startup line `tadhkir-loop: Bismillah`; spinner `<zikr> · <meaning>…` changing every 8 s; done line `✻ Alhamdulillah · Ns`. Toggle `Show meaning` off in `/config` and check the meaning disappears on the next turn.

- [ ] **Step 7: Commit**

```bash
git add .claude-plugin/plugin.json .claude-plugin/marketplace.json .gitignore hooks/hooks.json hooks/register.js hooks/register.test.ts data/content.js
git commit -m "Add Tadhkir Loop mod with starter zikr content"
```

---

### Task 3: Hadith text helpers (`tools/extract.js`)

**Files:**
- Create: `tools/extract.js`
- Test: `tools/extract.test.ts`

**Interfaces:**
- Produces: `extract(text: string): { narrator: string, quote: string } | null` and `cleanName(transliteration: string): string`.

- [ ] **Step 1: Write the failing tests** (fixture text is fake, written in the API's style):

```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `claude plugin test tools`
Expected: FAIL, `extract.js` not found.

- [ ] **Step 3: Implement `tools/extract.js`.**
  - Narrator: `^Narrated\s+([^:]+):`, trimmed, leading `'` or `` ` `` removed.
  - Quote: the first `"..."` that starts within 40 characters after one of `The Prophet (ﷺ) said`, `the Prophet (ﷺ) said`, `Allah's Messenger (ﷺ) said`, `Allah's Messenger (ﷺ) saying`, `the Messenger of Allah (ﷺ) said`, and is closed. Anything else returns `null`. Never guess.
  - `cleanName`: replace the space after a leading `Al|Ar|As|At|Ad|An|Az|Ash|Adh|Ath` with `-`, then `aa→a`, `ee→i`, `oo→u`. It is only a first draft; the reviewer edits it.

- [ ] **Step 4: Run to verify it passes**

Run: `claude plugin test tools`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/extract.js tools/extract.test.ts
git commit -m "Add hadith extractor and name cleaner for the content workshop"
```

---

### Task 4: Candidate fetch script (`tools/fetch-candidates.js`)

**Files:**
- Create: `tools/fetch-candidates.js`, `tools/zikr.json`

**Interfaces:**
- Consumes: `extract`, `cleanName` from Task 3.
- Produces: `tools/candidates.json` (gitignored), shape:
  `{ zikr: Entry-like[], names: [{ number, en, meaning, ar, sourceTransliteration }], hadith: [{ id, collection, number, narrator, en, original, ar, url }] }`

- [ ] **Step 1: Create `tools/zikr.json`** holding the same 12 rows as Task 2's table (`id`, `en`, `meaning`, `ar: ""`), so the review page reviews zikr too.

- [ ] **Step 2: Implement `tools/fetch-candidates.js`** (Node 18+, built-in `fetch` and `fs`, no packages):
  1. Fetch `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/{eng,ara}-{bukhari,muslim}.json`.
  2. For each English hadith: `extract(text)`; keep it only if not `null` and `quote.length <= 200`. Join Arabic by `hadithnumber`. `id` = `<collection lowercase>-<hadithnumber>`, `number` = `String(hadithnumber)`, `url` = `https://sunnah.com/<collection lowercase>:<hadithnumber>` as a first guess the reviewer corrects.
  3. Fetch `https://api.aladhan.com/v1/asmaAlHusna`; map each to `{ number, en: cleanName(transliteration), meaning: en.meaning, ar: name, sourceTransliteration: transliteration }`.
  4. Read `tools/zikr.json`. Write `tools/candidates.json` and print counts: `zikr N, names 99, hadith Bukhari X, Muslim Y`, plus rejected counts per collection by reason: `no narrator`, `no Prophet quote` (extract returned null), `too long`. A pattern that silently drops most of a collection must be visible here.

- [ ] **Step 3: Run it**

Run: `node tools/fetch-candidates.js`
Expected: prints counts with `names 99` and non-zero Bukhari hadith; `tools/candidates.json` exists. Open it and check 3 random hadith: `en` is the Prophet's words from `original`, and the narrator matches.

- [ ] **Step 4: Commit**

```bash
git add tools/fetch-candidates.js tools/zikr.json
git commit -m "Add candidate fetch script for hadith and the 99 names"
```

---

### Task 5: Review page (`tools/review.html`)

**Files:**
- Create: `tools/review.html` (one file, inline CSS and JS, no libraries)

**Interfaces:**
- Consumes: `tools/candidates.json` (Task 4 shape) via a file input.
- Produces: a downloaded `content.js` in the shape `data/content.js` uses (Task 2), with `approvedAt` (local `YYYY-MM-DD`) on every hadith.

- [ ] **Step 1: Build the page.** Behaviour:
  - File input loads `candidates.json`. Tabs or a filter for Zikr / Names / Hadith, with a progress count (`approved / rejected / left`).
  - One card at a time. Hadith card: full `original`, editable `en` (shown text), editable `narrator`, editable `number`, editable `url` with an "Open" link, and a live preview of the formatted line exactly as users will see it: `"<en>" (<narrator>, <Collection> <number>)`. Names and zikr cards: editable `en` and `meaning`, plus `sourceTransliteration` for names.
  - Keys: `A` approve (saves the current edited values), `R` reject, `←`/`→` move. Typing in a field must not trigger the keys.
  - Progress and edits saved to `localStorage` keyed by item `id` (names by `number`), wrapped in try/catch; reloading the page and loading the same file restores progress.
  - Warn on a hadith card if the edited `en` is over 200 characters.
  - "Download content.js" writes `export default ` + `JSON.stringify({ version: 1, zikr, names, hadith }, null, 2)` with approved items only. Hadith keep `original` for audit, as spec 6.1 says.

- [ ] **Step 2: Manual check in Chrome.** Open `tools/review.html`, load `tools/candidates.json`, approve 2 zikr, 2 names (edit one spelling), 1 hadith (edit its number), reject 1 hadith. Reload the page and reload the file: the same decisions **and the edited spelling and number** show. Download `content.js`; check it holds exactly those approved items with the edits and `approvedAt`.

- [ ] **Step 3: Check the output loads in the mod.** Copy the downloaded file over `data/content.js` in a scratch copy only (not the repo), run `node -e "import('./data/content.js').then(m => console.log(Object.keys(m.default)))"` there. Expected: `[ 'version', 'zikr', 'names', 'hadith' ]`.

- [ ] **Step 4: Commit**

```bash
git add tools/review.html
git commit -m "Add local review page for approving content"
```

---

### Task 6: Owner content review, README, release checks

This task has a human step: the owner reviews the content. Nothing ships without it.

**Files:**
- Modify: `data/content.js` (replaced by the owner's reviewed download)
- Create: `README.md`, `LICENSE`

- [ ] **Step 1: Owner review.** The owner runs `node tools/fetch-candidates.js`, opens `tools/review.html`, checks the 12 zikr (transliteration and meaning) against a reliable source rather than only reading the English, reviews all 99 names, and hadith until about 100 to 200 are approved, checking each against its sunnah.com page (number, wording, context). Save the download as `data/content.js`.

- [ ] **Step 2: Run tests on real content**

Run: `claude plugin test`
Expected: all pass, and the `session start` test now logs a `Hadith of the day` line.

- [ ] **Step 3: Write `README.md`** with: what it does (3 screens from the spec appendix), install commands (`/plugin marketplace add Ashikur540/tadhkir-loop-claude-plugin`, `/plugin install tadhkir-loop@tadhkir-loop`), requires Claude Code 2.1.299+, the two `/config` switches plus the tip that `/config` > Show tips hides Claude's own tip line, the security note (spec 8.1), content sources and credits (spec 8.2: hadith-api, Muhsin Khan, Abdul Hamid Siddiqui, aladhan.com, sunnah.com links), and how to suggest a hadith (open an issue with the sunnah.com link).

- [ ] **Step 4: Add `LICENSE`**: MIT for the code (owner's choice), and set `license` in `plugin.json` to `MIT`. The README states that MIT covers the code only, not the bundled translations (spec 8.2).

- [ ] **Step 5: Final checks**

Run: `claude plugin validate --strict . && claude plugin test`
Expected: `✔ Validation passed` with no warnings, all tests pass.

Manual: `claude --plugin-dir .` in Terminal; check every screen in the spec appendix, both switches, and the hadith line hiding when the window is under 60 columns. Then load it in the Desktop app and record what shows there in the README.

- [ ] **Step 6: Commit**

```bash
git add data/content.js README.md LICENSE .claude-plugin/plugin.json
git commit -m "Add reviewed content, README and license"
```

- [ ] **Step 7: Release gate (owner decides).** Before pushing to the public repo: confirm the content licensing question in spec 8.2. Pushing and tagging happen only on the owner's go-ahead.
