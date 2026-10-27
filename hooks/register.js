// Tadhkir Loop: zikr and names in the spinner, a hadith under it,
// Alhamdulillah on the done line, Bismillah and the hadith of the day at startup.
import raw from '../data/content.js'
import { loadContent, wordAt, hadithOfDay, randomHadith, hadithParts,
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
  // Hadith of the day above the prompt, hidden once the first message goes
  let showCard = opts.showHadith

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
    if (showCard) {
      showCard = false
      $.ui.invalidate('ui.render')
    }
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
    // On the desktop the word is Claude's real step ("Creating notes.md"); keep it
    if (e.surface !== 'terminal' || e.props.message) return next(e)
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

  on('ui.render', { component: 'TurnDuration' }, async ($, e, next) => {
    // "Waiting for 2 background agents" and the ctrl+o view stay Claude Code's
    if (e.props.waitingFor || e.props.isExpanded) return next(e)
    const { Text } = $.ui.resolve(e)
    return Text({ dimColor: true, children: ['✻ Alhamdulillah · ' + formatDuration(e.props.durationMs)] })
  }).catch(() => undefined)

  on('session.start', async ($, e, next) => {
    $.ui.log('Bismillah')
    return next(e)
  }).catch(() => undefined)

  // The log line can't hold line breaks, so the hadith of the day gets the band
  // above the prompt, until the first message
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const h = showCard && !e.props.hasSurvey && !e.props.view?.agentId
      ? hadithOfDay(CONTENT, new Date(await $.clock.now())) : null
    if (!h) return next(e)
    const { quote, source } = hadithParts(h)
    const { Box, Text } = $.ui.resolve(e)
    return Box({ flexDirection: 'column', paddingLeft: 2, children: [
      Text({ dimColor: true, italic: true, children: [quote] }),
      Box({ paddingLeft: 2, children: [Text({ dimColor: true, children: [source] })] }),
    ] })
  }).catch(() => undefined)
}
