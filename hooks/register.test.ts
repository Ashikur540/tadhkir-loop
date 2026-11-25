import { expect, mock, test } from 'claude-code/testing'
import raw from '../data/content.js'
import { SPINNER_EXTRA } from './picker.js'

// ---- Fixtures ----

const POOL = [...raw.zikr, ...raw.names]
const WORDS = new Set(POOL.map((x) => x.en))
/** The narrowest terminal where the shortest name still fits beside Claude Code's status. */
const MIN_COLUMNS = 2 + Math.min(...POOL.map((x) => x.en.length)) + SPINNER_EXTRA
const STAR_FRAMES = ['·', '✢', '*', '✶', '✻', '✽', '✽', '✻', '✶', '*', '✢', '·']
const QUOTE = /^".+"$/
const SOURCE = /^~ .+ · (Bukhari|Muslim) \S+$/
/** A desktop zikr part is the name alone or the name with its meaning, never cut. */
const wholeEntry = (part: string) => POOL.find((x: any) => part === x.en || part === `${x.en} · ${x.meaning}`)

const SPINNER = { plugin: 'tadhkir-loop', component: 'Spinner', requestId: 'main', surface: 'terminal',
  viewport: { columns: 100, rows: 30 }, props: { word: 'Baking', message: null, suffix: '…', mode: 'thinking' } } as const
const DONE = { plugin: 'tadhkir-loop', component: 'TurnDuration', requestId: 'done', surface: 'terminal',
  viewport: { columns: 100, rows: 30 }, props: { word: 'Baked', durationMs: 41000 } } as const
const BAND = { plugin: 'tadhkir-loop', component: 'AbovePrompt', requestId: 'band', surface: 'terminal',
  viewport: { columns: 100, rows: 30 }, props: { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 15, bodyColumns: 95,
    scroll: { offset: 0, bodyRows: 14 }, view: {} } } as const

/** A finished main answer. */
const done = (turnId: string, durationMs = 1000) => ({ turnId, answer: '', durationMs, isAborted: false, reason: 'answer' as const })

/**
 * Stands in for Claude Code under our spinner hook: it records the word we hand it
 * and draws `word|suffix`, so a test can read both.
 */
const engine = (on: any, seen: string[]) => {
  on('ui.render', ($: any, e: any) => { seen.push(e.props.word); return { type: 'Text', props: {}, children: [e.props.word + '|' + e.props.suffix] } })
  on('turn.start', ($: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
}

/** Records every log line. */
const logger = (on: any, logs: string[]) => {
  on('session.start', () => ({ cwd: '/work' }))
  on('ui.log', ($: any, e: any) => { logs.push(e.text); return { value: undefined } })
  on('turn.start', ($: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
}

/** VS Code and the Desktop app start Claude like an SDK host (not interactive), then attach their window. */
const app = (surfaces: string[]) => async ($: any, on: any, logs: string[], attach = true) => {
  mock.clock(on); logger(on, logs)
  on('session.attach', ($: any, e: any) => ({ clientId: e.clientId }))
  on('session.surfaces', () => ({ value: surfaces }))
  await $.session.start({ surface: null, isInteractive: false, cwd: '/work' })
  if (attach) await $.session.attach({ surface: surfaces.at(-1), clientId: 'app-1' })
}
const vscode = app(['vscode'])
const desktop = app(['desktop'])

/** Claude Code's own band, under ours. */
const emptyBand = (on: any) => on('ui.render', () => ({ type: 'Box', props: {}, children: [] }))

// ---- Terminal spinner ----

test('the terminal spinner shows a zikr with its meaning and a hadith, and moves on every 8 s', async ($, on) => {
  const seen: string[] = []; const clock = mock.clock(on); engine(on, seen)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  // Wide enough that even the longest zikr keeps its meaning
  const ui = await $.ui.mount({ ...SPINNER, viewport: { columns: 200, rows: 30 } })
  const first = seen.at(-1)!
  expect(WORDS.has(first)).toBe(true)
  expect(await ui.find({ type: 'Text', text: /\| · .+…$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: QUOTE })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: SOURCE })).toBeDefined()
  await clock.advance(8000)
  expect(seen.at(-1)).not.toBe(first)
})
test('in a narrow window every spinner word fits on one line', async ($, on) => {
  const seen: string[] = []; const clock = mock.clock(on); engine(on, seen)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.ui.mount({ ...SPINNER, viewport: { columns: 80, rows: 30 } })
  for (let i = 0; i < 115; i++) await clock.advance(8000)
  expect(seen.length).toBeGreaterThan(100)
  expect(seen.filter((w) => 2 + w.length + SPINNER_EXTRA > 80)).toEqual([])
})
test('when no word fits the window, the spinner and its hadith are left to Claude Code', async ($, on) => {
  const seen: string[] = []; mock.clock(on); engine(on, seen)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  expect(MIN_COLUMNS).toBe(68)   // the README says "about 68 columns"
  const ui = await $.ui.mount({ ...SPINNER, viewport: { columns: MIN_COLUMNS - 1, rows: 30 } })
  expect(seen.at(-1)).toBe('Baking')
  expect(await ui.find({ type: 'Text', text: QUOTE })).toBeUndefined()
})
test('with Show meaning off, the terminal spinner keeps the word and its hadith only', { options: { show_meaning: false } }, async ($, on) => {
  const seen: string[] = []; mock.clock(on); engine(on, seen)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  const ui = await $.ui.mount({ ...SPINNER, viewport: { columns: 200, rows: 30 } })
  expect(WORDS.has(seen.at(-1)!)).toBe(true)
  expect(await ui.find({ type: 'Text', text: /\| · / })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: QUOTE })).toBeDefined()
})
test('with Show hadith off, the terminal spinner has no hadith under it', { options: { show_hadith: false } }, async ($, on) => {
  const seen: string[] = []; mock.clock(on); engine(on, seen)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  const ui = await $.ui.mount({ ...SPINNER, viewport: { columns: 200, rows: 30 } })
  expect(WORDS.has(seen.at(-1)!)).toBe(true)
  expect(await ui.find({ type: 'Text', text: QUOTE })).toBeUndefined()
})
test('the mobile app, which we do not draw on, keeps Claude Code\'s own spinner', async ($, on) => {
  const seen: string[] = []; mock.clock(on); engine(on, seen)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.ui.mount({ ...SPINNER, surface: 'mobile' })
  expect(seen.at(-1)).toBe('Baking')
})
test('Claude Code status messages pass through untouched', async ($, on) => {
  const seen: string[] = []; mock.clock(on); engine(on, seen)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.ui.mount({ ...SPINNER, props: { ...SPINNER.props, message: 'Compacting conversation' } })
  expect(seen.at(-1)).toBe('Baking')
})

// ---- Redraw timer ----

test('no redraws after the main turn completes', async ($, on) => {
  const seen: string[] = []; const clock = mock.clock(on); engine(on, seen)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.ui.mount(SPINNER)
  await $.turn.complete(done('t1'))
  const count = seen.length
  await clock.advance(24000)
  expect(seen.length).toBe(count)
})
test('no redraws after the session ends mid-turn', async ($, on) => {
  const seen: string[] = []; const clock = mock.clock(on); engine(on, seen)
  on('session.end', () => ({ sessionId: 's1' }))
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.ui.mount(SPINNER)
  await $.session.end({ reason: 'prompt_input_exit' })
  const count = seen.length
  await clock.advance(24000)
  expect(seen.length).toBe(count)
})
test('a subagent turn does not stop the main rotation', async ($, on) => {
  const seen: string[] = []; const clock = mock.clock(on); engine(on, seen)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.turn.start({ text: 'task', turnId: 's1', agentId: 'agent-1' })
  await $.ui.mount(SPINNER)
  await $.turn.complete(done('s1'))
  const count = seen.length
  await clock.advance(8000)
  expect(seen.length).toBeGreaterThan(count)
})
test('a new main turn cancels the old turn\'s timer, so redraws do not double up', async ($, on) => {
  const seen: string[] = []; const clock = mock.clock(on); engine(on, seen)
  await $.turn.start({ text: 'one', turnId: 't1' })
  await clock.advance(4000)
  // Half way through t1's 8 s, so a leftover t1 timer would fire between t2's own ticks
  await $.turn.start({ text: 'two', turnId: 't2' })
  await $.ui.mount(SPINNER)
  const count = seen.length
  await clock.advance(24000)
  expect(seen.length - count).toBe(3)
})
test('a second main turn replaces the first turn\'s timer', async ($, on) => {
  const seen: string[] = []; const clock = mock.clock(on); engine(on, seen)
  await $.turn.start({ text: 'one', turnId: 't1' })
  await $.turn.start({ text: 'two', turnId: 't2' })
  await $.ui.mount(SPINNER)
  await $.turn.complete(done('t2'))
  const count = seen.length
  await clock.advance(24000)
  expect(seen.length).toBe(count)
})

test('a turn that ends while it is still starting leaves no timer and no start card', async ($, on) => {
  const seen: string[] = []; const clock = mock.clock(on); engine(on, seen)
  // The surfaces answer late, after the turn has already completed
  on('session.surfaces', async ($: any) => { await $.clock.sleep(1000); return { value: ['terminal'] } })
  const starting = $.turn.start({ text: 'hi', turnId: 't1' })
  const completing = $.turn.complete(done('t1'))
  await clock.advance(1000)
  await Promise.all([starting, completing])
  await $.ui.mount(SPINNER)
  const count = seen.length
  await clock.advance(24000)
  expect(seen.length).toBe(count)
  const band = await $.ui.mount(BAND)
  expect(await band.find({ type: 'Text', text: QUOTE })).toBeUndefined()
})

// ---- Done line and greetings ----

test('the done line reads Alhamdulillah with the duration', async ($, on) => {
  mock.clock(on)
  const ui = await $.ui.mount(DONE)
  expect(await ui.find({ type: 'Text', text: '✻ Alhamdulillah · 41s' })).toBeDefined()
})
test('the done line leaves the waiting-for-agents text and the ctrl+o view to Claude Code', async ($, on) => {
  mock.clock(on)
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['engine line'] }))
  const waiting = await $.ui.mount({ ...DONE, props: { ...DONE.props,
    waitingFor: { agents: [{ id: 'a1', agentType: 'general-purpose' }], workflows: 0 } } })
  expect(await waiting.find({ type: 'Text', text: 'engine line' })).toBeDefined()
  const expanded = await $.ui.mount({ ...DONE, requestId: 'done-expanded', props: { ...DONE.props, isExpanded: true } })
  expect(await expanded.find({ type: 'Text', text: 'engine line' })).toBeDefined()
})
test('an interactive session start logs one Bismillah line', async ($, on) => {
  const logs: string[] = []; mock.clock(on); logger(on, logs)
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  expect(logs).toEqual(['Bismillah'])
})
test('a -p or SDK run logs no Bismillah', async ($, on) => {
  const logs: string[] = []; mock.clock(on); logger(on, logs)
  await $.session.start({ surface: null, isInteractive: false, cwd: '/work' })
  expect(logs).toEqual([])
})
test('the terminal gets no Alhamdulillah row, its own done line already says it', async ($, on) => {
  const logs: string[] = []; mock.clock(on); logger(on, logs)
  on('session.surfaces', () => ({ value: ['terminal'] }))
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.turn.complete(done('t1', 41000))
  expect(logs).toEqual(['Bismillah'])
})
test('with the terminal and VS Code both showing, the terminal\'s done line is enough', async ($, on) => {
  const logs: string[] = []; await app(['terminal', 'vscode'])($, on, logs)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.turn.complete(done('t1', 41000))
  expect(logs).toEqual(['Bismillah'])
})

test('a reopened conversation gets no second Bismillah: it is already in the history', async ($, on) => {
  const logs: string[] = []; mock.clock(on); logger(on, logs)
  on('session.turns', () => ({ value: 3 }))
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  expect(logs).toEqual([])
})
test('reopening a Desktop or VS Code conversation adds no second Bismillah', async ($, on) => {
  const logs: string[] = []
  on('session.turns', () => ({ value: 2 }))
  await desktop($, on, logs)
  expect(logs).toEqual([])
})

test('a new Desktop session started by its first message still gets Bismillah', async ($, on) => {
  // With no spare process ready, the app starts Claude Code with the first message, so by
  // the time the window attaches the count already includes it
  const logs: string[] = []
  let started = false
  on('session.turns', () => ({ value: started ? 1 : 0 }))
  await desktop($, on, logs, false)
  started = true
  await $.session.attach({ surface: 'desktop', clientId: 'app-1' })
  expect(logs).toEqual(['Bismillah'])
})

// ---- VS Code ----

test('in VS Code the spinner becomes our own colored zikr line, with no hadith', async ($, on) => {
  const seen: string[] = []; mock.clock(on); engine(on, seen)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  // VS Code reported 49 columns for a wide panel; its status sits on its own line, so no width rule there
  const ui = await $.ui.mount({ ...SPINNER, surface: 'vscode', viewport: { columns: 49, rows: 38 }, props: { ...SPINNER.props, word: 'Pondering' } })
  // We draw the whole line, so Claude Code's row (and VS Code's plugin-name prefix) never shows
  expect(seen).toEqual([])
  const texts: any[] = await ui.findAll({ type: 'Text' })
  expect(WORDS.has(texts.find((t) => t.props?.color === 'success')?.children?.[0])).toBe(true)
  // No trailing "…" on our own line: after a meaning it reads as cut-off text
  expect(await ui.find({ type: 'Text', text: /^ · [^…]+$/ })).toBeDefined()
  expect(STAR_FRAMES).toContain(texts.find((t) => t.props?.color === 'claude')?.children?.[0])
  expect(await ui.find({ type: 'Text', text: QUOTE })).toBeUndefined()
})
test('in VS Code the text star flips to Claude\'s next frame every 120 ms', async ($, on) => {
  const seen: string[] = []; const clock = mock.clock(on); engine(on, seen)
  on('session.surfaces', () => ({ value: ['vscode'] }))
  await $.turn.start({ text: 'hi', turnId: 't1' })
  const ui = await $.ui.mount({ ...SPINNER, surface: 'vscode', viewport: { columns: 49, rows: 38 }, props: { ...SPINNER.props, word: 'Pondering' } })
  const glyphs: any[] = []
  for (let i = 0; i < 12; i++) {
    const texts: any[] = await ui.findAll({ type: 'Text' })
    glyphs.push(texts.find((t) => t.props?.color === 'claude')?.children?.[0])
    await clock.advance(120)
  }
  // The same 12 frames as Claude's own star, in order, from wherever the cycle stood
  const start = STAR_FRAMES.indexOf(glyphs[0])
  expect(glyphs).toEqual([...STAR_FRAMES, ...STAR_FRAMES].slice(start, start + 12))
})
test('with Show meaning off, VS Code shows the name alone', { options: { show_meaning: false } }, async ($, on) => {
  const seen: string[] = []; mock.clock(on); engine(on, seen)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  const ui = await $.ui.mount({ ...SPINNER, surface: 'vscode', props: { ...SPINNER.props, word: 'Pondering' } })
  expect(await ui.find({ type: 'Text', text: /^ · / })).toBeUndefined()
})
test('in VS Code, Bismillah once when the panel attaches, even if it attaches again', async ($, on) => {
  const logs: string[] = []; await vscode($, on, logs)
  await $.session.attach({ surface: 'vscode', clientId: 'app-1' })
  expect(logs).toEqual(['Bismillah'])
})
test('in VS Code, Alhamdulillah with the time after each main answer, not after a subagent', async ($, on) => {
  const logs: string[] = []; await vscode($, on, logs)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.turn.start({ text: 'sub', turnId: 's1', agentId: 'a1' })
  await $.turn.complete({ ...done('s1', 5000), agentId: 'a1' })
  await $.turn.complete(done('t1', 41000))
  expect(logs).toEqual(['Bismillah', 'Alhamdulillah · 41s'])
})
test('in VS Code, Alhamdulillah still comes after a reload, when no attach is raised again', async ($, on) => {
  const logs: string[] = []; await vscode($, on, logs, false)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.turn.complete(done('t1', 41000))
  expect(logs).toEqual(['Alhamdulillah · 41s'])
})
test('in VS Code, no Alhamdulillah when the person stops the turn or it ends in an error', async ($, on) => {
  const logs: string[] = []; await vscode($, on, logs)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.turn.complete({ ...done('t1', 3000), isAborted: true, reason: 'aborted' })
  await $.turn.start({ text: 'again', turnId: 't2' })
  await $.turn.complete({ ...done('t2', 3000), reason: 'error' })
  expect(logs).toEqual(['Bismillah'])
})

// ---- Desktop app ----

test('on the desktop only the words change: the zikr leads, Claude Code\'s step follows', async ($, on) => {
  const seen: string[] = []; mock.clock(on); engine(on, seen)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  const ui = await $.ui.mount({ ...SPINNER, surface: 'desktop', props: { ...SPINNER.props, word: 'Creating notes.md' } })
  // Claude Code draws the row with our words, so the desktop keeps its animated icon and timer
  const word = seen.at(-1) ?? ''
  // "|" reads as two separate things, so the step never seems to describe the name
  expect(word.endsWith(' | Creating notes.md')).toBe(true)
  expect(wholeEntry(word.slice(0, -' | Creating notes.md'.length))).toBeDefined()
  expect(await ui.find({ type: 'Box' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: QUOTE })).toBeUndefined()
})
test('on the desktop a long zikr drops its meaning, and no entry is ever cut', async ($, on) => {
  const seen: string[] = []; const clock = mock.clock(on); engine(on, seen)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.ui.mount({ ...SPINNER, surface: 'desktop', props: { ...SPINNER.props, word: 'Working' } })
  for (let i = 0; i < 115; i++) await clock.advance(8000)
  const parts = [...new Set(seen)].map((w) => w.slice(0, -' | Working'.length))
  // The desktop line never wraps, so the zikr part stays short enough to leave room for the step
  for (const part of parts) {
    const whole = wholeEntry(part)
    expect(whole).toBeDefined()
    if (part !== whole.en) expect(part.length).toBeLessThanOrEqual(40)
  }
  expect(parts.some((p) => POOL.some((x: any) => p === x.en && `${x.en} · ${x.meaning}`.length > 40))).toBe(true)
})
test('with Show meaning off, the desktop shows the name alone before the step', { options: { show_meaning: false } }, async ($, on) => {
  const seen: string[] = []; mock.clock(on); engine(on, seen)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.ui.mount({ ...SPINNER, surface: 'desktop', props: { ...SPINNER.props, word: 'Working' } })
  expect(WORDS.has(seen.at(-1)!.slice(0, -' | Working'.length))).toBe(true)
})
test('a desktop status message passes through untouched', async ($, on) => {
  const seen: string[] = []; mock.clock(on); engine(on, seen)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.ui.mount({ ...SPINNER, surface: 'desktop', props: { ...SPINNER.props, word: 'Working', message: 'Compacting conversation' } })
  expect(seen.at(-1)).toBe('Working')
})
test('in the Desktop app, Bismillah once when it attaches, and Alhamdulillah after a finished answer', async ($, on) => {
  const logs: string[] = []; await desktop($, on, logs)
  await $.session.attach({ surface: 'desktop', clientId: 'app-1' })
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.turn.complete(done('t1', 41000))
  await $.turn.start({ text: 'again', turnId: 't2' })
  await $.turn.complete({ ...done('t2', 3000), isAborted: true, reason: 'aborted' })
  expect(logs).toEqual(['Bismillah', 'Alhamdulillah · 41s'])
})

// ---- Start card above the prompt ----

test('the hadith of the day sits above the prompt until the first message', async ($, on) => {
  mock.clock(on); emptyBand(on)
  on('turn.start', ($: any, e: any) => ({ turnId: e.turnId }))
  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Text', text: QUOTE })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: SOURCE })).toBeDefined()
  await $.turn.start({ text: 'hi', turnId: 't1' })
  expect(await ui.find({ type: 'Text', text: QUOTE })).toBeUndefined()
})
test('the Desktop start page shows Bismillah and the hadith of the day until the first message', async ($, on) => {
  mock.clock(on); emptyBand(on)
  on('turn.start', ($: any, e: any) => ({ turnId: e.turnId }))
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  // The desktop's start page shows no log lines, so Bismillah goes in the card
  expect(await ui.find({ type: 'Text', text: 'Bismillah' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: QUOTE })).toBeDefined()
  await $.turn.start({ text: 'hi', turnId: 't1' })
  expect(await ui.find({ type: 'Text', text: 'Bismillah' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: QUOTE })).toBeUndefined()
})
test('with Show hadith off, the Desktop start page still says Bismillah, and the terminal band stays empty', { options: { show_hadith: false } }, async ($, on) => {
  mock.clock(on); emptyBand(on)
  const desktopBand = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await desktopBand.find({ type: 'Text', text: 'Bismillah' })).toBeDefined()
  expect(await desktopBand.find({ type: 'Text', text: QUOTE })).toBeUndefined()
  const terminal = await $.ui.mount({ ...BAND, requestId: 'band-terminal' })
  expect(await terminal.find({ type: 'Text', text: 'Bismillah' })).toBeUndefined()
  expect(await terminal.find({ type: 'Text', text: QUOTE })).toBeUndefined()
})
test('the card keeps what other mods draw in the band', async ($, on) => {
  mock.clock(on)
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['other band'] }))
  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Text', text: QUOTE })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'other band' })).toBeDefined()
})
test('the start card stays hidden while Claude is working, as after a reload mid-turn', async ($, on) => {
  mock.clock(on); emptyBand(on)
  const working = { ...BAND.props, isWorking: true }
  const terminal = await $.ui.mount({ ...BAND, props: working })
  expect(await terminal.find({ type: 'Text', text: QUOTE })).toBeUndefined()
  const desktopBand = await $.ui.mount({ ...BAND, requestId: 'band-desktop', surface: 'desktop', props: working })
  expect(await desktopBand.find({ type: 'Text', text: 'Bismillah' })).toBeUndefined()
})
test('the start card stays out of a survey, a subagent\'s view, and VS Code', async ($, on) => {
  mock.clock(on); emptyBand(on)
  const survey = await $.ui.mount({ ...BAND, props: { ...BAND.props, hasSurvey: true } })
  expect(await survey.find({ type: 'Text', text: QUOTE })).toBeUndefined()
  const agentView = await $.ui.mount({ ...BAND, requestId: 'band-agent', props: { ...BAND.props, view: { agentId: 'a1' } } })
  expect(await agentView.find({ type: 'Text', text: QUOTE })).toBeUndefined()
  // VS Code does not show this band
  const vscodeBand = await $.ui.mount({ ...BAND, requestId: 'band-vscode', surface: 'vscode' })
  expect(await vscodeBand.find({ type: 'Text', text: QUOTE })).toBeUndefined()
})
test('the start card stays hidden in a conversation that already has messages, as after reopening or a reload', async ($, on) => {
  mock.clock(on); emptyBand(on)
  on('session.turns', () => ({ value: 1 }))
  const terminal = await $.ui.mount(BAND)
  expect(await terminal.find({ type: 'Text', text: QUOTE })).toBeUndefined()
  const desktopBand = await $.ui.mount({ ...BAND, requestId: 'band-desktop', surface: 'desktop' })
  expect(await desktopBand.find({ type: 'Text', text: 'Bismillah' })).toBeUndefined()
})
