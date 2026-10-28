import { expect, mock, test } from 'claude-code/testing'

const SPINNER = { plugin: 'tadhkir-loop', component: 'Spinner', requestId: 'main', surface: 'terminal',
  viewport: { columns: 100, rows: 30 }, props: { word: 'Baking', message: null, suffix: '…', mode: 'thinking' } } as const
const stubs = (on: any, seen: string[]) => {
  on('ui.render', ($: any, e: any) => { seen.push(e.props.word); return { type: 'Text', props: {}, children: [e.props.word + '|' + e.props.suffix] } })
  on('turn.start', ($: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
}
const done = (turnId: string) => ({ turnId, answer: '', durationMs: 1000, isAborted: false })

test('spinner shows a zikr word with its meaning and rotates every 8 s', async ($, on) => {
  const seen: string[] = []; const clock = mock.clock(on); stubs(on, seen)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  // Wide enough that even the longest zikr keeps its meaning (narrow widths drop it on purpose)
  const ui = await $.ui.mount({ ...SPINNER, viewport: { columns: 200, rows: 30 } })
  const first = seen.at(-1)
  expect(first).not.toBe('Baking')
  expect(await ui.find({ type: 'Text', text: /\| · .+…$/ })).toBeDefined()
  // Hadith: quote and source on their own lines, under the spinner
  expect(await ui.find({ type: 'Text', text: /^".+"$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^~ .+ · (Bukhari|Muslim) \S+$/ })).toBeDefined()
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
const DONE = { plugin: 'tadhkir-loop', component: 'TurnDuration', requestId: 'm2', surface: 'terminal',
  viewport: { columns: 100, rows: 30 }, props: { word: 'Baked', durationMs: 41000 } } as const
test('done line leaves the waiting-for-agents text and the ctrl+o view to Claude Code', async ($, on) => {
  mock.clock(on)
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['engine line'] }))
  const waiting = await $.ui.mount({ ...DONE, props: { ...DONE.props,
    waitingFor: { agents: [{ id: 'a1', agentType: 'general-purpose' }], workflows: 0 } } })
  expect(await waiting.find({ type: 'Text', text: 'engine line' })).toBeDefined()
  const expanded = await $.ui.mount({ ...DONE, requestId: 'm3', props: { ...DONE.props, isExpanded: true } })
  expect(await expanded.find({ type: 'Text', text: 'engine line' })).toBeDefined()
})
test('on the desktop the spinner keeps Claude Code\'s step text', async ($, on) => {
  const seen: string[] = []; mock.clock(on); stubs(on, seen)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  const ui = await $.ui.mount({ ...SPINNER, surface: 'desktop', props: { ...SPINNER.props, word: 'Creating notes.md' } })
  expect(seen.at(-1)).toBe('Creating notes.md')
  expect(await ui.find({ type: 'Text', text: /^".+"$/ })).toBeUndefined()
})
test('session start logs one Bismillah line', async ($, on) => {
  const logs: string[] = []; mock.clock(on)
  on('session.start', () => ({ cwd: '/work' }))
  on('ui.log', ($: any, e: any) => { logs.push(e.text); return { value: undefined } })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  expect(logs).toEqual(['Bismillah'])
})
test('a -p or SDK run logs no Bismillah', async ($, on) => {
  const logs: string[] = []; mock.clock(on)
  on('session.start', () => ({ cwd: '/work' }))
  on('ui.log', ($: any, e: any) => { logs.push(e.text); return { value: undefined } })
  await $.session.start({ surface: null, isInteractive: false, cwd: '/work' })
  expect(logs).toEqual([])
})
const BAND = { plugin: 'tadhkir-loop', component: 'AbovePrompt', requestId: 'band', surface: 'terminal',
  viewport: { columns: 100, rows: 30 }, props: { hasSurvey: false, isWorking: false, maxRows: 15, bodyColumns: 95,
    scroll: { offset: 0, bodyRows: 14 }, view: {} } } as const
test('hadith of the day sits above the prompt until the first message', async ($, on) => {
  mock.clock(on)
  on('ui.render', () => ({ type: 'Box', props: {}, children: [] }))
  on('turn.start', ($: any, e: any) => ({ turnId: e.turnId }))
  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Text', text: /^".+"$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^~ .+ · (Bukhari|Muslim) \S+$/ })).toBeDefined()
  await $.turn.start({ text: 'hi', turnId: 't1' })
  expect(await ui.find({ type: 'Text', text: /^".+"$/ })).toBeUndefined()
})
test('the desktop band gets no card until it has been checked there', async ($, on) => {
  mock.clock(on)
  on('ui.render', () => ({ type: 'Box', props: {}, children: [] }))
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /^".+"$/ })).toBeUndefined()
})
test('the card keeps what other mods draw in the band', async ($, on) => {
  mock.clock(on)
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['other band'] }))
  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Text', text: /^".+"$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'other band' })).toBeDefined()
})
test('in a narrow window every spinner word fits on one line', async ($, on) => {
  const seen: string[] = []; const clock = mock.clock(on); stubs(on, seen)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.ui.mount({ ...SPINNER, viewport: { columns: 80, rows: 30 } })
  for (let i = 0; i < 115; i++) await clock.advance(8000)
  expect(seen.length).toBeGreaterThan(100)
  expect(seen.filter((w) => 2 + w.length + 60 > 80)).toEqual([])
})
test('a survey in the band is left alone', async ($, on) => {
  mock.clock(on)
  on('ui.render', () => ({ type: 'Box', props: {}, children: [] }))
  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, hasSurvey: true } })
  expect(await ui.find({ type: 'Text', text: /^".+"$/ })).toBeUndefined()
})
