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
  // Wide enough that even the longest zikr keeps its meaning (narrow widths drop it on purpose)
  const ui = await $.ui.mount({ ...SPINNER, viewport: { columns: 200, rows: 30 } })
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
