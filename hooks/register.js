// Tadhkir Loop: zikr and names in the spinner, a hadith under it,
// Alhamdulillah on the done line, Bismillah and the hadith of the day at startup.
import raw from '../data/content.js'
import { loadContent, wordAt, hadithOfDay, randomHadith, hadithParts,
  formatDuration, spinnerParts } from './picker.js'

const ROTATE_MS = 8000
const CONTENT = loadContent(raw)
// VS Code's spinner star: our line replaces Claude's animated one, and text can't move, so an SVG
// flips through Claude's own frames (12 of 120 ms) and stays a still ✻ under reduced motion
const FRAMES = ['·', '✢', '*', '✶', '✻', '✽']
const STAR = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">' +
  '<style>text{font:16px monospace;fill:#d97757;opacity:0;animation:f 1.44s step-end infinite}' +
  '@keyframes f{0%{opacity:1}8.3333%{opacity:0}}' +
  '@media (prefers-reduced-motion:reduce){text{animation:none}.still{opacity:1}}</style>' +
  [...FRAMES, ...[...FRAMES].reverse()].map((glyph, i) =>
    `<text x="8" y="8" text-anchor="middle" dominant-baseline="central"${i === 4 ? ' class="still"' : ''} ` +
    `style="animation-delay:${((i - 12) * 0.12).toFixed(2)}s">${glyph}</text>`).join('') +
  '</svg>'

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
  // VS Code runs Claude like an SDK host (not interactive) and keeps its own done line,
  // so there Bismillah waits for its panel and Alhamdulillah gets a row of its own
  let isTerminal = false
  let inVscode = false
  let saidBismillah = false

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
    if (e.turnId === mainTurnId) {
      stopTimer()
      if (inVscode && !isTerminal) $.ui.log('Alhamdulillah · ' + formatDuration(e.durationMs))
    }
    return next(e)
  }).catch(() => undefined)

  on('session.end', async ($, e, next) => {
    stopTimer()
    return next(e)
  }).catch(() => undefined)

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    // On the desktop the word is Claude's real step ("Creating notes.md"); keep it.
    // VS Code shows a fun word ("Pondering"), like the terminal
    if ((e.surface !== 'terminal' && e.surface !== 'vscode') || e.props.message) return next(e)
    // The width rule is for the terminal, where Claude's status shares the spinner line.
    // VS Code puts its status on its own line, wraps text, and reports far fewer columns than it shows
    const columns = e.surface === 'terminal' ? e.viewport?.columns : undefined
    const entry = wordAt(CONTENT, (await $.clock.now()) - turnStart, turnOffset, columns)
    if (!entry) return next(e)
    if (e.surface === 'vscode') {
      // VS Code puts a plugin's name before a rewritten word. Our own line keeps the name off
      // the zikr (VS Code shows it as a header instead) and lets it take color; no hadith there
      const { Box, Text, Svg } = $.ui.resolve(e)
      return Box({ flexDirection: 'row', alignItems: 'center', gap: 1, children: [
        Svg({ source: STAR, alt: 'Working', width: 16, height: 16, isInteractive: true }),
        Text({ children: [
          Text({ color: 'success', weight: 'semibold', children: [entry.en] }),
          Text({ dimColor: true, children: [opts.showMeaning ? ' · ' + entry.meaning + '…' : '…'] }),
        ] }),
      ] })
    }
    const parts = spinnerParts(entry, turnHadith, opts, columns)
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
    isTerminal = !!e.isInteractive
    if (isTerminal) {
      $.ui.log('Bismillah')
      saidBismillah = true
    }
    return next(e)
  }).catch(() => undefined)

  on('session.attach', async ($, e, next) => {
    if (e.surface === 'vscode') {
      inVscode = true
      // Once per session, though the panel attaches again when it is reopened
      if (!saidBismillah) $.ui.log('Bismillah')
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
