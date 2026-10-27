# Zikr Mode: design

Date: 2026-10-26
Status: draft, waiting for review

## 1. Why

Coders spend a lot of time watching Claude Code work. Zikr Mode turns that
waiting time into a small moment of remembrance. Instead of words like
"Baking" or "Pondering", the screen shows zikr, the 99 names of Allah with
their meaning, and short authentic hadith. The coder reads them while they
wait and gets the benefit of the remembrance.

Over time the product should do three things (in phases):

1. **Remind**: a calm, low-key zikr in front of the coder's eyes.
2. **Teach**: over weeks they learn the 99 names, their meanings, and a set
   of hadith.
3. **Build a habit**: a tasbih-like counter (Phase 2).

## 2. Goals, non-goals, anti-goals

**Phase 1 goals**

- Spinner word shows zikr and the 99 names in English transliteration
  ("SubhanAllah", "Ar-Rahman").
- The meaning of the current word shows on the same spinner line, right
  after the word: `Ar-Rahman · The Most Merciful…`.
- A line under the spinner shows one short hadith for the whole turn.
- The line that closes a turn reads "Alhamdulillah · 14s".
- At session start: one line, "Bismillah · Hadith of the day: ...".
- Two switches in `/config`: Show hadith, Show meaning.
- Installable from a public GitHub repo that is its own marketplace.

**Non-goals for Phase 1** (later phases)

- Zikr counter (Phase 2).
- Showing Arabic text (Phase 2, after testing how terminals render it).
- Pulling new content from the internet at runtime.
- Replacing the Claude Code logo (not possible with the mods API).
- Polish for the VS Code extension.

**Anti-goals** (failure even if the code works)

- Showing any hadith that is not from Sahih al-Bukhari or Sahih Muslim.
- Showing any hadith that a human did not approve.
- Showing a wrong reference number.
- Breaking or slowing down the coder's work. If the mod fails, Claude Code
  must look normal.

## 3. Decisions made with the owner

| Topic | Decision |
|---|---|
| Plugin name | `zikr-mode`, display name "Zikr Mode" (names starting with `claude-` are reserved) |
| Technology | A Claude Code **mod** (plugin with a hooks module), not settings JSON |
| Surfaces | Terminal first, Desktop app second |
| English style | Transliteration ("SubhanAllah"), not translation |
| Spinner pool | Zikr and the 99 names, mixed |
| Spinner speed | Word changes about every 8 seconds |
| Meaning | On the spinner line after the word (`Ar-Rahman · The Most Merciful…`), changes with it. Chosen after the spike showed Claude's own `Tip:` line sits between the spinner and any line we add below it |
| Hadith line | One hadith per turn, fixed while the turn runs |
| Done line | Always "Alhamdulillah · <duration>" |
| Startup | One line: "Bismillah · Hadith of the day: ..." (same hadith all day). Claude Code prefixes it with the plugin name: `zikr-mode: Bismillah · ...` |
| Hadith rule | Bukhari and Muslim only, always with reference |
| Reference numbers | Shown number is the **sunnah.com** number, the one users will look up. The reviewer confirms it against the sunnah.com page |
| Hadith format | Prophet's ﷺ quoted words + narrator + reference: `"..." (Abu Huraira, Bukhari 1234)` |
| Picking | Script finds short candidates, owner approves each in a local review page |
| Content storage | Bundled JSON inside the plugin, no runtime network |
| Settings | Show hadith, Show meaning. Language switch removed from Phase 1 (only one option), comes back in Phase 2 with Arabic |
| Distribution | Public GitHub repo, `/plugin marketplace add <owner>/zikr-mode` |

## 4. Builder's calls (made by Claude, owner can change)

- Arabic text is stored in `content.json` now (same API call), so Phase 2
  Arabic needs no second review. It is not displayed in Phase 1.
- Hadith of the day is computed from the user's **local** calendar date.
  Users in different time zones can see different hadith at the same moment.
- Each turn starts the spinner rotation at a random point in the pool, and
  the 8 seconds count from the start of the turn.
- When the terminal is narrower than 60 columns, the hadith line is hidden
  instead of squeezed. Religious text is never cut off mid-sentence.
- Hadith candidates are limited to about 200 characters of shown text.
- Minimum Claude Code version: 2.1.299.

## 5. Facts checked during design

- **Hadith API**: `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/`.
  Free, no key. Editions `eng-bukhari`, `eng-muslim`, `ara-bukhari`,
  `ara-muslim`. Each hadith has `hadithnumber`, `arabicnumber`, `text`,
  `grades`, `reference`.
- **99 names API**: `https://api.aladhan.com/v1/asmaAlHusna`. Free, no key.
  Each entry has `name` (Arabic), `transliteration` (e.g. "Ar Rahmaan"),
  `number`, `en.meaning`.
- **Mods API**. Source of truth is the types file Claude Code writes into
  `.claude-plugin/types/claude-code/index.d.ts` when the mod loads with
  `--plugin-dir`. The copy on GitHub can be older.
  - `$.clock.every(ms, fn)` returns a `Timer` object. Stop it with
    `timer.cancel()`. (Calling it like a function throws; the spike hit this.)
  - `$.ui.log(text)` is drawn like a dim system notice, prefixed with the
    plugin name, and is **not sent to the model**, so it costs no tokens.
  - `ui.render` with `component: 'Spinner'`: props `word`, `message`,
    `suffix`, `mode`. A hook can pass changed props to `next`, or return
    `Box` with Claude Code's drawing plus extra `Text` lines under it.
  - `next(e)` at the Spinner site returns `{ type: 'engine', ref }`, and the
    docs show placing it in a `Box` next to our own elements.
  - Claude Code does **not** re-run a `ui.render` hook on a timer. It only
    redraws when the site's props or the terminal width change. A mod must
    call `$.ui.invalidate('ui.render')` itself, for example from
    `$.clock.every(...)`. Redraws are throttled and coalesced.
  - `ui.render` with `component: 'TurnDuration'`: props `word`,
    `durationMs`. A hook can draw its own line.
  - `InfoNotice` (lines under the logo) can only rewrite notices that
    already exist, so it cannot add a startup line. Startup uses
    `$.ui.log(text)` in a `session.start` hook instead, which writes a line
    into the transcript.
  - Plugin `userConfig` fields show as rows in `/config`. `options` on a
    string field needs Claude Code 2.1.271 or later.
  - A plugin `settings.json` only accepts `agent` and `subagentStatusLine`,
    so `spinnerVerbs` cannot be shipped by a plugin. This is why we use a mod.
- **Spike results (2026-10-27, Claude Code 2.1.310, terminal)**: all five
  behaviours confirmed on screen: word swap keeps Claude's color, timer
  and status text; the word and meaning change every 8 s; a hadith line
  draws under the spinner; the done line reads `✻ Alhamdulillah · 41s`; the
  startup line shows at the top. Claude's own `⎿ Tip:` line is part of
  Claude Code's spinner drawing, so any line we add lands **below** the tip.
- **Still open**: the narrow-width rule (hidden hadith under 60 columns) and
  the Desktop app were not checked in the spike. Check both during the build.

## 6. Architecture

```
zikr-mode/                       (repo root, public on GitHub)
├── .claude-plugin/
│   ├── plugin.json              name, version, userConfig (2 switches)
│   └── marketplace.json         repo is its own marketplace, source "./"
├── hooks/
│   ├── hooks.json               { "modules": ["./register.js"] }
│   ├── register.js              the mod: wires events to picker
│   ├── picker.js                pure functions, no Claude Code imports
│   └── picker.test.ts           tests for picker
├── data/
│   └── content.json             approved content, shipped
├── tools/                       owner's content workshop, not used at runtime
│   ├── zikr.json                hand-written zikr list (~12)
│   ├── fetch-candidates.js      APIs → candidates.json
│   ├── extract.js               pulls quote + narrator out of a hadith text
│   ├── extract.test.ts          tests for extract
│   └── review.html              approve / reject → content.json
└── README.md
```

### 6.1 `data/content.json`

```json
{
  "version": 1,
  "zikr": [
    { "id": "subhanallah", "en": "SubhanAllah", "meaning": "Glory be to Allah", "ar": "..." }
  ],
  "names": [
    { "number": 1, "en": "Ar-Rahman", "meaning": "The Most Merciful", "ar": "..." }
  ],
  "hadith": [
    {
      "id": "bukhari-1",
      "collection": "Bukhari",
      "number": 1,
      "narrator": "Umar bin Al-Khattab",
      "en": "<the Prophet's quoted words, as shown>",
      "original": "<full API text, kept for audit>",
      "ar": "...",
      "url": "https://sunnah.com/bukhari:1",
      "approvedAt": "2026-10-27"
    }
  ]
}
```

Every hadith in this file was approved by a human in the review page.

### 6.2 `hooks/picker.js` (pure, testable)

- `loadContent(json)` validates the shape and returns content, or `null` if
  it is broken.
- `wordAt(content, elapsedMs, turnOffset)` returns `{ en, meaning }` from one
  pool entry, so the word and its meaning can never mismatch. The pool is
  zikr + names. Index = `(turnOffset + floor(elapsedMs / 8000)) % pool.length`,
  where `elapsedMs` is time since the turn started.
- `hadithOfDay(content, date)` returns the hadith. Index = days since epoch
  (local date) `% hadith.length`. Known and accepted: when an update adds
  hadith, the hadith of the day can change in the middle of that day.
- `randomHadith(content, rand)` returns one hadith for a turn.
- `formatHadith(h)` returns `"<en>" (<narrator>, <collection> <number>)`.
- `formatDuration(ms)` returns "14s", "1m 4s", matching Claude Code's style.

### 6.3 `hooks/register.js` (the mod)

`register(on, options)` gets `options.show_hadith` and
`options.show_meaning`.

- Load `data/content.json` once. If `loadContent` returns `null`, register
  nothing, so Claude Code behaves normally.
- `turn.start`: save the turn start time, a random `turnOffset`, and the
  turn's hadith (`randomHadith`). Start `$.clock.every(8000, () =>
  $.ui.invalidate('ui.render'))` so the spinner redraws with the next word.
- `turn.complete`: `timer.cancel()`, so nothing redraws while idle.
- `session.end`: `timer.cancel()` too, in case a turn never completed.
- `ui.render` `{ component: 'Spinner' }`: if `e.props.message` is set
  (Claude Code is showing a status of its own), pass the event on unchanged.
  Otherwise call `next` with `word` = `wordAt(...).en` and, if Show meaning
  is on, `suffix` = `' · ' + meaning + '…'`. Return a `Box` (column) holding
  Claude Code's drawing, then a dim `Text` with the turn's hadith if Show
  hadith is on and `e.viewport.columns` is 60 or more.
- `ui.render` `{ component: 'TurnDuration' }`: return our own `Text`:
  `Alhamdulillah · <formatDuration(durationMs)>`.
- `session.start`: one `$.ui.log` call: `"Bismillah"`, plus
  `" · Hadith of the day: " + formatHadith(hadithOfDay(...))` if Show hadith
  is on. One call, so the `zikr-mode:` prefix shows once. It fires again
  after a plugin reload, which is fine.
- Every hook has a `.catch` that falls back to `next(e)`.

### 6.4 `tools/` (content workshop)

**`fetch-candidates.js`** (run by hand with Node):

1. Fetch `eng-bukhari`, `eng-muslim`, `ara-bukhari`, `ara-muslim`.
2. For each English hadith, run `extract(text)` to get `{ narrator, quote }`.
   Drop it if there is no quote, or the quote is over ~200 characters.
3. Join the Arabic text by hadith number.
4. Fetch the 99 names. Pre-fill a cleaned spelling (e.g. "Ar Rahmaan" →
   "Ar-Rahman") that the owner can edit.
5. Read `zikr.json`.
6. Write `candidates.json`.

**`extract.js`**: finds the narrator from "Narrated X:" and the first
quoted saying of the Prophet ﷺ. Returns `null` when unsure, so unclear
hadith are dropped and never guessed.

**`review.html`** (opened in Chrome, no server):

- File input loads `candidates.json`.
- One card at a time: full original text, shown text, reference,
  sunnah.com link. Names and zikr show editable spelling and meaning fields.
- The reviewer approves the **exact text users will see**. If they edit the
  shown text, the edited version is what gets approved and shipped. Each
  approved item stores `approvedAt` (date).
- The extractor only suggests candidates. It is never treated as
  verification.
- Keys: `A` approve, `R` reject. Progress is saved in `localStorage`.
- "Download content.json" writes only approved items in the 6.1 shape.
- The reviewer opens the sunnah.com link and checks it shows the same
  hadith. The number field is editable: the reviewer sets it (and the URL)
  to the **sunnah.com** number, because that is what users will look up.
  If the right sunnah.com page can't be found, reject the card.
- The reviewer also checks **context**: the first quote in a hadith is
  sometimes a question or a companion speaking, not the lesson. Reject
  quotes that mislead without the rest of the text.

## 7. Settings (`plugin.json` `userConfig`)

| Key | Type | Default | Title |
|---|---|---|---|
| `show_hadith` | boolean | `true` | Show hadith |
| `show_meaning` | boolean | `true` | Show meaning |

Phase 2 adds a `language` string field with `options: ["english", "arabic"]`
and default `english`, so existing users keep English.

## 8. Error handling

- Missing or broken `content.json`: no hooks registered, Claude Code looks
  normal.
- Any hook throws or times out: `.catch` returns `next(e)`, so Claude Code
  draws its own version.
- Empty hadith list: hadith lines are skipped, zikr still shows.
- `loadContent` drops single bad records (missing `en`, `meaning`,
  reference) instead of failing the whole file.
- A hook throwing during render must not leave the timer running forever:
  the timer is stopped on `turn.complete` and on `session.end`.
- Mods need Claude Code 2.1.299+. On older versions the README tells the
  user to update.

## 8.1 Security note (goes in README)

- No network requests at runtime. Content ships inside the plugin.
- Reads only its own `data/content.json`. Does not read project files.
- No telemetry, no user data collected.
- No third-party runtime dependencies.

## 9. Testing

- **Spike: done** (see section 5). The screens in the appendix are
  confirmed in the terminal.
- `hooks/picker.test.ts`: word changes after 8 s and stays within 8 s;
  meaning always matches word; hadith of day is stable within a day and
  changes next day; `loadContent` returns `null` on bad input;
  `formatDuration` and `formatHadith` output.
- `tools/extract.test.ts`: a few real API samples (with narrator, without
  quote, very long) give the expected result or `null`.
- `claude plugin validate --strict` passes.
- `claude plugin test` passes.
- Manual: `claude --plugin-dir .` in Terminal, check spinner, meaning,
  hadith, done line, startup line, each `/config` switch, and the hadith
  line hiding under 60 columns. Then check the Desktop app.

## 10. Phase 2 (not designed yet)

- Zikr counter ("You read 340 zikr this week"), probably stored with
  `$.store`.
- Arabic display, after testing in macOS Terminal, iTerm2 and the VS Code
  terminal.
- Maybe: daily remote content updates, listing in Anthropic's directory.

## Appendix: screens (confirmed in the terminal by the spike)

Lines from Zikr Mode are dim except the spinner word, which keeps Claude
Code's own color. The hadith shown is a real one (Bukhari 1, from the API);
the shipped list holds only reviewed hadith.

**Session start**

```
 ▐▛███▜▌   Claude Code v2.1.310
▝▜█████▛▘  Opus 5.5 · Claude Max
  ▘▘ ▝▝    ~/projects/my-app

  zikr-mode: Bismillah · Hadith of the day: "The reward of deeds depends
  upon the intentions and every person will get the reward according to
  what he has intended." (Umar bin Al-Khattab, Bukhari 1)
```

**While Claude works** (word and meaning change every 8 s, hadith stays)

```
✻ Ar-Rahman · The Most Merciful… (26s · thinking more with high effort)
  ⎿  Tip: Press Shift+Enter to send a multi-line message
  "The reward of deeds depends upon the intentions and every person will
  get the reward according to what he has intended." (Umar bin Al-Khattab, Bukhari 1)
```

The `Tip:` line is Claude Code's own and appears only sometimes. Users can
turn it off in `/config` > Show tips.

**Show meaning off**

```
✻ Ar-Rahman… (26s)
  "The reward of deeds depends upon the intentions ..." (Umar bin Al-Khattab, Bukhari 1)
```

**Show hadith off, or terminal under 60 columns**

```
✻ Ar-Rahman · The Most Merciful… (26s)
```

**Turn finished**

```
  ...last line of Claude's answer.
✻ Alhamdulillah · 41s
```

**Content broken or a hook fails**: Claude Code's normal look
(`✻ Pondering…`, `✻ Baked for 41s`).
