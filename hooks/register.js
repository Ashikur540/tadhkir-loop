// Tadhkir Loop: zikr and names in the spinner, a hadith under it,
// Alhamdulillah on the done line, Bismillah and the hadith of the day at startup.
import raw from '../data/content.js'
import { loadContent, wordAt, hadithOfDay, randomHadith, hadithParts,
  formatDuration, spinnerParts } from './picker.js'

const ROTATE_MS = 8000
const CONTENT = loadContent(raw)
// VS Code's spinner star: our line replaces Claude's animated one, so we flip through Claude's own
// frames as text, redrawing every 120 ms. An animated picture moves on its own, but VS Code
// holds back a picture that keeps animating through a long turn
const STAR_FRAMES = ['·', '✢', '*', '✶', '✻', '✽', '✽', '✻', '✶', '*', '✢', '·']
const STAR_MS = 120
// Apps with a window of their own: they run Claude like an SDK host (not interactive), attach
// their window, and draw their own done line
const APPS = ['vscode', 'desktop']

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
  // VS Code runs Claude like an SDK host (not interactive), so its Bismillah waits for its panel
  let saidBismillah = false

  on('turn.start', async ($, e, next) => {
    if (e.agentId) return next(e)
    timer?.cancel()
    mainTurnId = e.turnId
    turnStart = await $.clock.now()
    turnOffset = Math.floor(Math.random() * poolLength)
    turnHadith = randomHadith(CONTENT, Math.random)
    // VS Code needs a redraw for every star frame; elsewhere only for the next word
    const surfaces = await $.session.surfaces().catch(() => [])
    timer = $.clock.every(surfaces?.includes('vscode') ? STAR_MS : ROTATE_MS, () => {
      if (mainTurnId) $.ui.invalidate('ui.render')
    })
    if (showCard) {
      showCard = false
      $.ui.invalidate('ui.render')
    }
    return next(e)
  }).catch(() => undefined)

  on('turn.complete', async ($, e, next) => {
    if (e.turnId === mainTurnId) {
      stopTimer()
      // VS Code and the Desktop app keep their own done line, so they get a row of their own,
      // for a finished answer only (not Stop or an error). Asked live: a reload forgets the attach
      if (e.reason === 'answer') {
        const surfaces = await $.session.surfaces()
        if (surfaces.some((s) => APPS.includes(s)) && !surfaces.includes('terminal')) {
          $.ui.log('Alhamdulillah · ' + formatDuration(e.durationMs))
        }
      }
    }
    return next(e)
  }).catch(() => undefined)

  on('session.end', async ($, e, next) => {
    stopTimer()
    return next(e)
  }).catch(() => undefined)

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (!['terminal', ...APPS].includes(e.surface) || e.props.message) return next(e)
    // The width rule is for the terminal, where Claude's status shares the spinner line.
    // VS Code puts its status on its own line, wraps text, and reports far fewer columns than it shows
    const columns = e.surface === 'terminal' ? e.viewport?.columns : undefined
    const elapsed = (await $.clock.now()) - turnStart
    const entry = wordAt(CONTENT, elapsed, turnOffset, columns)
    if (!entry) return next(e)
    const parts = spinnerParts(entry, e.surface === 'terminal' ? turnHadith : null, opts, columns)
    // The apps' line: no trailing "…", which after a meaning reads as cut-off text
    const meaning = (parts.suffix ?? '').replace(/…$/, '')
    if (e.surface === 'desktop') {
      // A plugin's own tree there drops the app's animated icon and elapsed time, so only the
      // words change: the zikr leads, and Claude's real step ("Creating notes.md") follows
      return next({ ...e, props: { ...e.props, word: `${entry.en}${meaning} — ${e.props.word}` } })
    }
    if (e.surface === 'vscode') {
      // VS Code puts a plugin's name before a rewritten word, so the zikr gets a line of our
      // own (VS Code shows the name as a header instead) and can take color; no hadith there
      const { Box, Text } = $.ui.resolve(e)
      const zikr = Text({ children: [
        Text({ color: 'success', weight: 'semibold', children: [entry.en] }),
        Text({ dimColor: true, children: [meaning] }),
      ] })
      // VS Code shows a fun word ("Pondering"), so our line takes its place, star and all
      const star = STAR_FRAMES[Math.floor(elapsed / STAR_MS) % STAR_FRAMES.length]
      return Box({ flexDirection: 'row', children: [
        // A fixed slot, as Claude's own star has, so the narrow frames don't shift the words
        Box({ width: 2, children: [Text({ color: 'claude', children: [star] })] }),
        zikr,
      ] })
    }
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
    // Only where a person reads it: a -p or SDK host would get it as a message
    if (e.isInteractive) {
      $.ui.log('Bismillah')
      saidBismillah = true
    }
    return next(e)
  }).catch(() => undefined)

  on('session.attach', async ($, e, next) => {
    // Once per session, though the window attaches again when it is reopened
    if (APPS.includes(e.surface) && !saidBismillah) {
      $.ui.log('Bismillah')
      saidBismillah = true
    }
    return next(e)
  }).catch(() => undefined)

  // The log line can't hold line breaks, so the hadith of the day gets the band
  // above the prompt, until the first message
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const h = showCard && e.surface === 'terminal' && !e.props.hasSurvey && !e.props.view?.agentId
      ? hadithOfDay(CONTENT, new Date(await $.clock.now())) : null
    if (!h) return next(e)
    const { quote, source } = hadithParts(h)
    const { Box, Text } = $.ui.resolve(e)
    const card = Box({ flexDirection: 'column', paddingLeft: 2, children: [
      Text({ dimColor: true, italic: true, children: [quote] }),
      Box({ paddingLeft: 2, children: [Text({ dimColor: true, children: [source] })] }),
    ] })
    // Keep other mods' bands, as the band docs ask
    const theirs = await next(e)
    return Box({ flexDirection: 'column', children: theirs ? [card, theirs] : [card] })
  }).catch(() => undefined)
}
