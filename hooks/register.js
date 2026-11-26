/**
 * Tadhkir Loop hooks: zikr and the names of Allah in Claude Code's spinner, a hadith
 * under it, Bismillah when a session starts and Alhamdulillah when a turn ends.
 *
 * The terminal, VS Code and the Desktop app each draw plugin content differently,
 * so the spinner has one renderer per surface.
 */
import raw from '../data/content.js'
import { loadContent, wordAt, hadithOfDay, randomHadith, hadithParts,
  doneText, spinnerParts, ROTATE_MS } from './picker.js'

const CONTENT = loadContent(raw)
const BISMILLAH = 'Bismillah'

/** Claude's own spinner frames, in the order it plays them. */
const STAR_FRAMES = ['·', '✢', '*', '✶', '✻', '✽', '✽', '✻', '✶', '*', '✢', '·']
const STAR_MS = 120

/** Surfaces that attach a window to a non-interactive session and draw their own done line. */
const APP_SURFACES = ['vscode', 'desktop']

/** Surfaces whose band above the prompt shows the start card. */
const CARD_SURFACES = ['terminal', 'desktop']

/** Longest zikr text on the desktop's one-line spinner; a longer meaning is dropped whole. */
const DESKTOP_ZIKR_MAX = 40
/** Sits between the zikr and Claude's step, e.g. `SubhanAllah | Reading notes.md`. */
const DESKTOP_SEPARATOR = ' | '

/** The quote with its source indented under it. */
function hadithBlock({ Box, Text }, { quote, source }, layout = {}) {
  return Box({ flexDirection: 'column', ...layout, children: [
    Text({ dimColor: true, italic: true, children: [quote] }),
    Box({ paddingLeft: 2, children: [Text({ dimColor: true, children: [source] })] }),
  ] })
}

// The spinner is drawn differently on each surface, so each has its own renderer.
// They are top-level functions because the plugin loader follows $ only into those.

// Claude's status shares this line, so the width matters; the hadith goes underneath.
async function terminalSpinner($, e, next, { entry, columns, hadith, opts }) {
  const parts = spinnerParts(entry, hadith, opts, columns)
  const props = { ...e.props, word: entry.en, ...(parts.meaning && { suffix: parts.meaning + '…' }) }
  const theirs = await next({ ...e, props })
  if (!parts.quote) return theirs
  const ui = $.ui.resolve(e)
  // The indent keeps wrapped lines aligned; the margin sets it apart from Claude's tip.
  return ui.Box({ flexDirection: 'column', children: [
    theirs, hadithBlock(ui, parts, { marginTop: 1, paddingLeft: 4 }),
  ] })
}

// VS Code puts the plugin's name before a rewritten word, so we draw the whole line,
// star included. The star is text because VS Code pauses long-running animated images.
function vscodeSpinner($, e, { entry, elapsed, opts }) {
  const { Box, Text } = $.ui.resolve(e)
  const { meaning } = spinnerParts(entry, null, opts)
  const star = STAR_FRAMES[Math.floor(elapsed / STAR_MS) % STAR_FRAMES.length]
  return Box({ flexDirection: 'row', children: [
    // A fixed-width slot, like Claude's own, so the narrow frames don't shift the text.
    Box({ width: 2, children: [Text({ color: 'claude', children: [star] })] }),
    Text({ children: [
      Text({ color: 'success', weight: 'semibold', children: [entry.en] }),
      ...(meaning ? [Text({ dimColor: true, children: [meaning] })] : []),
    ] }),
  ] })
}

// The desktop drops its animated icon and timer when a plugin draws its own tree, and its
// line never wraps, so only the words change: the zikr, then Claude's real step.
function desktopSpinner(e, next, { entry, opts }) {
  const { meaning } = spinnerParts(entry, null, opts)
  const full = entry.en + (meaning ?? '')
  const zikr = full.length <= DESKTOP_ZIKR_MAX ? full : entry.en
  return next({ ...e, props: { ...e.props, word: `${zikr}${DESKTOP_SEPARATOR}${e.props.word}` } })
}

/** The surfaces we draw the spinner on. */
const SPINNER_SURFACES = ['terminal', 'vscode', 'desktop']

/** The surfaces showing this session; empty when they can't be read. */
async function readSurfaces($) {
  return (await $.session.surfaces().catch(() => null)) ?? []
}

/**
 * Whether the conversation already has messages: it was reopened, or the plugin
 * reloaded mid-conversation (which raises session.start again with fresh state).
 * Its Bismillah is already in the saved history, so we don't add another.
 * Reads only the count of prompts sent, never their text.
 */
async function isUnderway($) {
  return ((await $.session.turns().catch(() => 0)) ?? 0) > 0
}

export function register(on, options) {
  if (!CONTENT) return
  const opts = {
    showHadith: options?.show_hadith !== false,
    showMeaning: options?.show_meaning !== false,
  }
  const poolLength = CONTENT.zikr.length + CONTENT.names.length
  // The main loop's current turn. Subagent turns are ignored, so one finishing early
  // can't stop the main spinner.
  const turn = { id: null, start: 0, offset: 0, hadith: null, timer: null }
  // The start card stays above the prompt until the first message.
  let startCard = true
  let greeted = false
  // Read at session.start, which comes before the first prompt. The apps may attach
  // only after a first message has started the process, so reading then would miss.
  let underway = false

  function endTurn() {
    turn.id = null
    turn.timer?.cancel()
    turn.timer = null
  }

  /** True the first time only, so Bismillah is said once per load of the plugin. */
  function firstGreeting() {
    if (greeted) return false
    greeted = true
    return true
  }

  // Every hook below ends in .catch, so a failing hook is skipped and never breaks Claude Code.
  on('turn.start', async ($, e, next) => {
    if (e.agentId) return next(e)
    turn.id = e.turnId
    // Before any wait, so a turn that ends at once can't bring the start card back.
    if (startCard) {
      startCard = false
      $.ui.invalidate('ui.render')
    }
    turn.start = await $.clock.now()
    turn.offset = Math.floor(Math.random() * poolLength)
    turn.hadith = randomHadith(CONTENT, Math.random)
    const drawn = await readSurfaces($)
    // The desktop shows no row logged while its window connects, so a new chat there
    // greets as Claude starts on the first message.
    if (drawn.includes('desktop') && !underway && firstGreeting()) $.ui.log(BISMILLAH)
    // A later turn started while we waited, and it owns the timer.
    if (turn.id !== e.turnId) return next(e)
    // VS Code's text star needs a frame every 120 ms; elsewhere only the word changes.
    const redrawMs = drawn.includes('vscode') ? STAR_MS : ROTATE_MS
    turn.timer?.cancel()
    turn.timer = $.clock.every(redrawMs, () => {
      if (turn.id) $.ui.invalidate('ui.render')
    })
    return next(e)
  }).catch(() => undefined)

  on('turn.complete', async ($, e, next) => {
    if (e.turnId !== turn.id) return next(e)
    endTurn()
    // The apps keep their own done line, so they get a row of their own, for a finished
    // answer only. Read the surfaces now: a reload does not raise session.attach again.
    if (e.reason === 'answer') {
      const drawn = await readSurfaces($)
      if (drawn.some((s) => APP_SURFACES.includes(s)) && !drawn.includes('terminal')) {
        $.ui.log(doneText(e.durationMs))
      }
    }
    return next(e)
  }).catch(() => undefined)

  on('session.end', async ($, e, next) => {
    endTurn()
    return next(e)
  }).catch(() => undefined)

  on('session.start', async ($, e, next) => {
    underway = await isUnderway($)
    // Only where a person reads it: a -p or SDK host would get it as a message.
    if (e.isInteractive && !underway && firstGreeting()) $.ui.log(BISMILLAH)
    return next(e)
  }).catch(() => undefined)

  on('session.attach', async ($, e, next) => {
    // VS Code starts non-interactive and shows a row logged when its panel attaches.
    if (e.surface === 'vscode' && !underway && firstGreeting()) $.ui.log(BISMILLAH)
    return next(e)
  }).catch(() => undefined)

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    // A status message such as "Compacting conversation" stays Claude Code's.
    if (!SPINNER_SURFACES.includes(e.surface) || e.props.message) return next(e)
    // Only the terminal's width limits the line: VS Code reports too few columns,
    // and the desktop line is cut to fit by DESKTOP_ZIKR_MAX instead.
    const columns = e.surface === 'terminal' ? e.viewport?.columns : undefined
    const elapsed = (await $.clock.now()) - turn.start
    const entry = wordAt(CONTENT, elapsed, turn.offset, columns)
    if (!entry) return next(e)
    const ctx = { entry, elapsed, columns, hadith: turn.hadith, opts }
    if (e.surface === 'vscode') return vscodeSpinner($, e, ctx)
    if (e.surface === 'desktop') return desktopSpinner(e, next, ctx)
    return terminalSpinner($, e, next, ctx)
  }).catch(() => undefined)

  on('ui.render', { component: 'TurnDuration' }, async ($, e, next) => {
    // "Waiting for 2 background agents" and the ctrl+o view stay Claude Code's.
    if (e.props.waitingFor || e.props.isExpanded) return next(e)
    const { Text } = $.ui.resolve(e)
    return Text({ dimColor: true, children: ['✻ ' + doneText(e.props.durationMs)] })
  }).catch(() => undefined)

  // The start card: the hadith of the day, which a one-line log can't hold. The desktop's
  // start page shows no log lines, so there the card carries Bismillah too.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const { isWorking, hasSurvey, view } = e.props
    if (isWorking || hasSurvey || view?.agentId || !CARD_SURFACES.includes(e.surface)) return next(e)
    // The card is for a new conversation only.
    if (startCard && (await isUnderway($))) startCard = false
    if (!startCard) return next(e)
    const hadith = opts.showHadith ? hadithOfDay(CONTENT, new Date(await $.clock.now())) : null
    const withBismillah = e.surface === 'desktop'
    if (!hadith && !withBismillah) return next(e)
    const ui = $.ui.resolve(e)
    const card = ui.Box({ flexDirection: 'column', paddingLeft: 2, children: [
      ...(withBismillah ? [ui.Text({ color: 'success', weight: 'semibold', children: [BISMILLAH] })] : []),
      ...(hadith ? [hadithBlock(ui, hadithParts(hadith))] : []),
    ] })
    // Keep other plugins' bands, as the band contract asks.
    const theirs = await next(e)
    return ui.Box({ flexDirection: 'column', children: theirs ? [card, theirs] : [card] })
  }).catch(() => undefined)
}
