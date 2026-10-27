// Tadhkir Loop: zikr and names in the spinner, a hadith under it,
// Alhamdulillah on the done line, Bismillah at startup.
import raw from '../data/content.js'
import { loadContent, wordAt, hadithOfDay, randomHadith, formatHadith,
  formatDuration, spinnerParts } from './picker.js'

const ROTATE_MS = 8000
const CONTENT = loadContent(raw)

// The main loop's current turn. Subagent turns are ignored, so one
// finishing early can't stop the main spinner's rotation.
let mainTurnId = null
let turnStart = 0
let turnOffset = 0
let turnHadith = null
let timer = null

function stopTimer() {
  mainTurnId = null
  timer?.cancel()
  timer = null
}

export function register(on, options) {
  if (!CONTENT) return
  const opts = {
    showHadith: options?.show_hadith !== false,
    showMeaning: options?.show_meaning !== false,
  }
  const poolLength = CONTENT.zikr.length + CONTENT.names.length

  on('turn.start', async ($, e, next) => {
    if (e.agentId) return next(e)
    timer?.cancel()
    mainTurnId = e.turnId
    turnStart = await $.clock.now()
    turnOffset = Math.floor(Math.random() * poolLength)
    turnHadith = randomHadith(CONTENT, Math.random)
    timer = $.clock.every(ROTATE_MS, () => {
      if (mainTurnId) $.ui.invalidate('ui.render')
    })
    return next(e)
  }).catch(() => undefined)

  on('turn.complete', async ($, e, next) => {
    if (e.turnId === mainTurnId) stopTimer()
    return next(e)
  }).catch(() => undefined)

  on('session.end', async ($, e, next) => {
    stopTimer()
    return next(e)
  }).catch(() => undefined)

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (e.props.message) return next(e)
    const entry = wordAt(CONTENT, (await $.clock.now()) - turnStart, turnOffset)
    const parts = spinnerParts(entry, turnHadith, opts, e.viewport?.columns)
    const theirs = await next({ ...e, props: { ...e.props, word: entry.en, ...(parts.suffix ? { suffix: parts.suffix } : {}) } })
    if (!parts.quote) return theirs
    const { Box, Text } = $.ui.resolve(e)
    // paddingLeft keeps wrapped lines in one column; the blank row sets it apart from Claude's tip
    const hadith = Box({ flexDirection: 'column', marginTop: 1, paddingLeft: 4, children: [
      Text({ dimColor: true, italic: true, children: [parts.quote] }),
      Box({ paddingLeft: 2, children: [Text({ dimColor: true, children: [parts.source] })] }),
    ] })
    return Box({ flexDirection: 'column', children: [theirs, hadith] })
  }).catch(() => undefined)

  on('ui.render', { component: 'TurnDuration' }, async ($, e) => {
    const { Text } = $.ui.resolve(e)
    return Text({ dimColor: true, children: ['✻ Alhamdulillah · ' + formatDuration(e.props.durationMs)] })
  }).catch(() => undefined)

  on('session.start', async ($, e, next) => {
    const h = opts.showHadith ? hadithOfDay(CONTENT, new Date(await $.clock.now())) : null
    $.ui.log('Bismillah' + (h ? ' · Hadith of the day: ' + formatHadith(h) : ''))
    return next(e)
  }).catch(() => undefined)
}
