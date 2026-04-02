import { prepare, layout, type PreparedText } from '@chenglou/pretext'

// ═══════════════════════════════════════════════════════════════════
// GLYPHFALL — A cyberpunk typing game powered by Pretext
// ═══════════════════════════════════════════════════════════════════

// ── Word corpus ──────────────────────────────────────────────────

const WORDS_EASY = [
  'flow', 'glyph', 'node', 'void', 'mesh', 'beam', 'sync', 'grid',
  'data', 'core', 'flux', 'byte', 'wave', 'link', 'port', 'path',
  'code', 'hack', 'root', 'hash', 'null', 'loop', 'fork', 'heap',
  'pipe', 'lock', 'edge', 'arc', 'scan', 'ping', 'push', 'pull',
]

const WORDS_MEDIUM = [
  'render', 'layout', 'canvas', 'signal', 'kernel', 'shader',
  'buffer', 'socket', 'vector', 'matrix', 'scroll', 'cursor',
  'thread', 'module', 'binary', 'cipher', 'neural', 'syntax',
  'pixel', 'reflow', 'bitmap', 'memory', 'bridge', 'beacon',
  'chrome', 'engine', 'stream', 'format', 'origin', 'tunnel',
]

const WORDS_HARD = [
  'typeface', 'grapheme', 'overflow', 'segmenter', 'terminal',
  'renderer', 'viewport', 'allocate', 'composit', 'debugger',
  'protocol', 'absolute', 'chromatic', 'parallax', 'cybernet',
  'hologram', 'spectrum', 'quantize', 'sequence', 'compiler',
]

type WordDifficulty = 'easy' | 'medium' | 'hard'
type GameMode = 'easy' | 'normal' | 'hard'

function pickWord(difficulty: WordDifficulty): string {
  const pool =
    difficulty === 'easy' ? WORDS_EASY :
    difficulty === 'medium' ? WORDS_MEDIUM :
    WORDS_HARD
  return pool[Math.floor(Math.random() * pool.length)]
}

function getDifficulty(elapsed: number, mode: GameMode): WordDifficulty {
  const r = Math.random()

  if (mode === 'easy') {
    if (elapsed < 20000) return 'easy'
    if (elapsed < 50000) return r < 0.6 ? 'easy' : 'medium'
    return r < 0.3 ? 'easy' : r < 0.8 ? 'medium' : 'hard'
  }

  if (mode === 'hard') {
    if (elapsed < 10000) return r < 0.3 ? 'medium' : 'hard'
    return r < 0.15 ? 'medium' : 'hard'
  }

  // normal
  if (elapsed < 15000) return r < 0.7 ? 'easy' : 'medium'
  if (elapsed < 35000) return r < 0.3 ? 'easy' : r < 0.7 ? 'medium' : 'hard'
  if (elapsed < 60000) return r < 0.1 ? 'easy' : r < 0.45 ? 'medium' : 'hard'
  return r < 0.3 ? 'medium' : 'hard'
}

// ── Difficulty mode speed/spawn tuning ───────────────────────────

function getSpeedForMode(mode: GameMode): { baseSpeed: number; maxSpeed: number; baseSpawn: number; minSpawn: number } {
  if (mode === 'easy') return { baseSpeed: 0.28, maxSpeed: 1.0, baseSpawn: 2800, minSpawn: 1000 }
  if (mode === 'hard') return { baseSpeed: 0.55, maxSpeed: 2.2, baseSpawn: 1600, minSpawn: 400 }
  return { baseSpeed: 0.4, maxSpeed: 1.8, baseSpawn: 2200, minSpawn: 600 }
}

// ── Colors & constants ───────────────────────────────────────────

const CYAN = '#00f0ff'
const MAGENTA = '#ff2d78'
const AMBER = '#ffb800'
const LIME = '#39ff14'
const VOID = '#05060a'

const FONT_GAME = '500 22px "Fira Code", "SF Mono", monospace'
const FONT_HUD = '500 12px "Orbitron", sans-serif'
const FONT_HUD_LARGE = '700 18px "Orbitron", sans-serif'
const FONT_COMBO = '900 48px "Orbitron", sans-serif'
const LINE_HEIGHT = 30
const THRESHOLD_Y_RATIO = 0.88
const MAX_LIVES = 3

// ── Sound engine (Web Audio API, synthesized) ────────────────────

let audioCtx: AudioContext | null = null
let soundEnabled = true

function initAudio() {
  if (audioCtx) return
  audioCtx = new AudioContext()
}

function playKeystroke() {
  if (!audioCtx || !soundEnabled) return
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.type = 'square'
  osc.frequency.value = 800 + Math.random() * 200
  gain.gain.setValueAtTime(0.03, audioCtx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.03)
  osc.connect(gain).connect(audioCtx.destination)
  osc.start()
  osc.stop(audioCtx.currentTime + 0.03)
}

function playWordComplete(currentCombo: number) {
  if (!audioCtx || !soundEnabled) return
  const baseFreq = 523 + currentCombo * 20
  const freq1 = Math.min(baseFreq, 1200)
  const freq2 = Math.min(baseFreq * 1.25, 1500)

  for (let i = 0; i < 2; i++) {
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = 'sine'
    osc.frequency.value = i === 0 ? freq1 : freq2
    const t = audioCtx.currentTime + i * 0.06
    gain.gain.setValueAtTime(0.08, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
    osc.connect(gain).connect(audioCtx.destination)
    osc.start(t)
    osc.stop(t + 0.15)
  }
}

function playBreachThud() {
  if (!audioCtx || !soundEnabled) return
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(55, audioCtx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.3)
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3)
  osc.connect(gain).connect(audioCtx.destination)
  osc.start()
  osc.stop(audioCtx.currentTime + 0.3)

  const bufSize = audioCtx.sampleRate * 0.1
  const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5
  const noise = audioCtx.createBufferSource()
  noise.buffer = buf
  const noiseGain = audioCtx.createGain()
  noiseGain.gain.setValueAtTime(0.15, audioCtx.currentTime)
  noiseGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12)
  const filter = audioCtx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 150
  noise.connect(filter).connect(noiseGain).connect(audioCtx.destination)
  noise.start()
  noise.stop(audioCtx.currentTime + 0.12)
}

function playComboMilestone(tier: number) {
  if (!audioCtx || !soundEnabled) return
  const baseNote = tier >= 15 ? 784 : tier >= 10 ? 659 : 523
  const notes = [baseNote, baseNote * 1.26, baseNote * 1.5]
  for (let i = 0; i < 3; i++) {
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = 'sine'
    osc.frequency.value = notes[i]
    const t = audioCtx.currentTime + i * 0.05
    gain.gain.setValueAtTime(0.1, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
    osc.connect(gain).connect(audioCtx.destination)
    osc.start(t)
    osc.stop(t + 0.1)
  }
}

// ── Sound toggle ─────────────────────────────────────────────────

const soundToggleBtn = document.getElementById('sound-toggle') as HTMLButtonElement

function updateSoundToggleUI() {
  soundToggleBtn.textContent = soundEnabled ? '♪' : '♪'
  soundToggleBtn.classList.toggle('muted', !soundEnabled)
  soundToggleBtn.title = soundEnabled ? 'Mute sound' : 'Unmute sound'
}

soundToggleBtn.addEventListener('click', () => {
  soundEnabled = !soundEnabled
  updateSoundToggleUI()
  try { localStorage.setItem('glyphfall-sound', soundEnabled ? '1' : '0') } catch {}
})

// Load saved preference
try {
  const saved = localStorage.getItem('glyphfall-sound')
  if (saved === '0') soundEnabled = false
} catch {}
updateSoundToggleUI()

// ── High score persistence ───────────────────────────────────────

let hiBestScore = 0
let hiBestCombo = 0
let hiBestWPM = 0
let newBestScore = false
let newBestCombo = false
let newBestWPM = false

function loadHighScores() {
  try {
    const raw = localStorage.getItem('glyphfall-hiscore')
    if (raw) {
      const data = JSON.parse(raw)
      hiBestScore = data.score || 0
      hiBestCombo = data.combo || 0
      hiBestWPM = data.wpm || 0
    }
  } catch {}
  updateStartScreenHighScores()
}

function saveHighScores(currentScore: number, currentCombo: number, currentWPM: number) {
  newBestScore = currentScore > hiBestScore
  newBestCombo = currentCombo > hiBestCombo
  newBestWPM = currentWPM > hiBestWPM

  if (newBestScore) hiBestScore = currentScore
  if (newBestCombo) hiBestCombo = currentCombo
  if (newBestWPM) hiBestWPM = currentWPM

  try {
    localStorage.setItem('glyphfall-hiscore', JSON.stringify({
      score: hiBestScore, combo: hiBestCombo, wpm: hiBestWPM,
    }))
  } catch {}
}

function updateStartScreenHighScores() {
  const el = document.getElementById('hi-scores')
  if (!el) return
  if (hiBestScore === 0 && hiBestCombo === 0 && hiBestWPM === 0) {
    el.classList.add('hidden')
    return
  }
  el.classList.remove('hidden')
  el.textContent = `BEST: ${hiBestScore}  |  COMBO: ${hiBestCombo}x  |  WPM: ${hiBestWPM}`
}

// ── Particle system ──────────────────────────────────────────────

type Particle = {
  x: number; y: number
  vx: number; vy: number
  life: number; maxLife: number
  size: number
  color: string
  type: 'spark' | 'ring' | 'ghost'
}

const particles: Particle[] = []

function spawnParticles(x: number, y: number, color: string, count: number) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.8
    const speed = 1.5 + Math.random() * 4
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.5,
      life: 1,
      maxLife: 0.4 + Math.random() * 0.6,
      size: 2 + Math.random() * 3,
      color,
      type: Math.random() > 0.6 ? 'ring' : 'spark',
    })
  }
  particles.push({
    x, y: y - 10,
    vx: 0, vy: -0.8,
    life: 1, maxLife: 0.8,
    size: 16,
    color,
    type: 'ghost',
  })
}

function spawnBreachParticles(x: number, y: number) {
  for (let i = 0; i < 30; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI
    const speed = 2 + Math.random() * 5
    particles.push({
      x: x + (Math.random() - 0.5) * 40,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      maxLife: 0.6 + Math.random() * 0.8,
      size: 1.5 + Math.random() * 2.5,
      color: MAGENTA,
      type: 'spark',
    })
  }
}

function updateParticles(dt: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.x += p.vx * dt * 60
    p.y += p.vy * dt * 60
    p.life -= dt / p.maxLife
    if (p.life <= 0) particles.splice(i, 1)
  }
}

function drawParticles(ctx: CanvasRenderingContext2D) {
  for (const p of particles) {
    const alpha = Math.max(0, p.life)
    ctx.globalAlpha = alpha
    if (p.type === 'spark') {
      ctx.fillStyle = p.color
      ctx.shadowColor = p.color
      ctx.shadowBlur = 8
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
      ctx.shadowBlur = 0
    } else if (p.type === 'ring') {
      ctx.strokeStyle = p.color
      ctx.lineWidth = 1.5
      ctx.shadowColor = p.color
      ctx.shadowBlur = 6
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * (1 - alpha) * 6, 0, Math.PI * 2)
      ctx.stroke()
      ctx.shadowBlur = 0
    }
  }
  ctx.globalAlpha = 1
}

// ── Score popups ─────────────────────────────────────────────────

type ScorePopup = {
  text: string
  x: number
  y: number
  life: number
  color: string
}

const scorePopups: ScorePopup[] = []

function updateScorePopups(dt: number) {
  for (let i = scorePopups.length - 1; i >= 0; i--) {
    const sp = scorePopups[i]
    sp.y -= dt * 50
    sp.life -= dt / 0.8
    if (sp.life <= 0) scorePopups.splice(i, 1)
  }
}

function drawScorePopups(ctx: CanvasRenderingContext2D) {
  for (const sp of scorePopups) {
    ctx.save()
    ctx.globalAlpha = Math.max(0, sp.life)
    ctx.fillStyle = sp.color
    ctx.shadowColor = sp.color
    ctx.shadowBlur = 10
    ctx.font = '700 16px "Orbitron", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(sp.text, sp.x, sp.y)
    ctx.restore()
  }
}

// ── Falling word ─────────────────────────────────────────────────

type FallingWord = {
  text: string
  x: number
  y: number
  speed: number
  width: number
  height: number
  prepared: PreparedText
  font: string
  matched: number
  active: boolean
  flash: number
  entryAnim: number
  difficulty: WordDifficulty
  pointValue: number
}

// ── Game state ───────────────────────────────────────────────────

type GameState = 'menu' | 'playing' | 'paused' | 'gameover'

let state: GameState = 'menu'
let gameMode: GameMode = 'normal'
let score = 0
let combo = 0
let bestCombo = 0
let multiplier = 1
let lives = MAX_LIVES
let wordsCompleted = 0
let startTime = 0
let lastSpawn = 0
let spawnInterval = 2200
let comboFlash = 0
let screenShake = 0
let screenShakeX = 0
let screenShakeY = 0
let breachFlash = 0
let pauseTime = 0
let totalKeystrokes = 0
let wrongKeystrokes = 0
let prevInputLength = 0
let lastGameScore = 0
let lastGameWPM = 0
let lastGameCombo = 0
let lastGameAccuracy = 100
let lastGameSurvivedSecs = 0
const fallingWords: FallingWord[] = []

// ── DOM refs ─────────────────────────────────────────────────────

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
const input = document.getElementById('type-input') as HTMLInputElement
const inputWrap = document.getElementById('input-wrap') as HTMLDivElement
const startScreen = document.getElementById('start-screen') as HTMLDivElement
const gameoverScreen = document.getElementById('gameover-screen') as HTMLDivElement
const pauseScreen = document.getElementById('pause-screen') as HTMLDivElement
const startBtn = document.getElementById('start-btn') as HTMLButtonElement
const restartBtn = document.getElementById('restart-btn') as HTMLButtonElement
const shareBtn = document.getElementById('share-btn') as HTMLButtonElement
const shareToast = document.getElementById('share-toast') as HTMLDivElement

// ── Canvas sizing ────────────────────────────────────────────────

let W = 0, H = 0, dpr = 1
const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0

function getVisibleHeight(): number {
  if (window.visualViewport) return window.visualViewport.height
  return window.innerHeight
}

function resize() {
  dpr = window.devicePixelRatio || 1
  W = window.innerWidth
  H = getVisibleHeight()
  canvas.width = Math.round(W * dpr)
  canvas.height = Math.round(H * dpr)
  canvas.style.width = `${W}px`
  canvas.style.height = `${H}px`
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

window.addEventListener('resize', resize)
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', resize)
}
resize()

// ── Pretext measurement ──────────────────────────────────────────

function measureWord(text: string): { width: number; height: number; prepared: PreparedText } {
  const prepared = prepare(text, FONT_GAME)
  const result = layout(prepared, 9999, LINE_HEIGHT)
  ctx.font = FONT_GAME
  const width = ctx.measureText(text).width
  return { width, height: result.height, prepared }
}

// ── Spawn a word ─────────────────────────────────────────────────

function spawnWord() {
  const elapsed = performance.now() - startTime
  const difficulty = getDifficulty(elapsed, gameMode)

  const onScreen = new Set(fallingWords.map(w => w.text))
  let text = pickWord(difficulty)
  let attempts = 0
  while (onScreen.has(text) && attempts < 20) {
    text = pickWord(difficulty)
    attempts++
  }
  if (onScreen.has(text)) return

  const { width, height, prepared } = measureWord(text)

  const margin = 60
  const x = margin + Math.random() * (W - width - margin * 2)

  const { baseSpeed, maxSpeed } = getSpeedForMode(gameMode)
  const speedRamp = Math.min(1, elapsed / 120000)
  const speed = baseSpeed + speedRamp * (maxSpeed - baseSpeed) + (Math.random() - 0.5) * 0.3

  const pointValue =
    difficulty === 'easy' ? 10 :
    difficulty === 'medium' ? 25 :
    50

  fallingWords.push({
    text, x, y: -height - 20,
    speed, width, height, prepared, font: FONT_GAME,
    matched: 0, active: false, flash: 0,
    entryAnim: 0, difficulty, pointValue,
  })
}

// ── Input handling ───────────────────────────────────────────────

function onInput() {
  if (state !== 'playing') return
  const typed = input.value.toLowerCase()
  const isNewChar = typed.length > prevInputLength
  prevInputLength = typed.length

  if (typed.length === 0) {
    for (const w of fallingWords) w.active = false
    return
  }

  if (isNewChar) {
    totalKeystrokes++
    playKeystroke()
  }

  let bestMatch: FallingWord | null = null
  let bestY = -Infinity

  for (const w of fallingWords) {
    const wLower = w.text.toLowerCase()
    if (wLower.startsWith(typed)) {
      if (w.y > bestY) {
        bestY = w.y
        bestMatch = w
      }
    }
  }

  for (const w of fallingWords) w.active = false

  if (bestMatch) {
    bestMatch.active = true
    bestMatch.matched = typed.length
    bestMatch.flash = 0.3

    if (typed.length === bestMatch.text.length) {
      completeWord(bestMatch)
      input.value = ''
      prevInputLength = 0
    }
  } else if (isNewChar) {
    wrongKeystrokes++
  }
}

function completeWord(w: FallingWord) {
  combo++
  if (combo > bestCombo) bestCombo = combo
  multiplier = 1 + Math.floor(combo / 5) * 0.5
  const points = Math.round(w.pointValue * multiplier)
  score += points
  wordsCompleted++
  comboFlash = 1

  playWordComplete(combo)
  if (combo === 5 || combo === 10 || combo === 15) {
    playComboMilestone(combo)
  }

  scorePopups.push({
    text: `+${points}`,
    x: w.x + w.width / 2,
    y: w.y,
    life: 1.0,
    color: combo >= 10 ? AMBER : combo >= 5 ? LIME : CYAN,
  })

  const cx = w.x + w.width / 2
  const cy = w.y + w.height / 2
  const color = combo >= 10 ? AMBER : combo >= 5 ? LIME : CYAN
  spawnParticles(cx, cy, color, 16 + combo * 2)

  const idx = fallingWords.indexOf(w)
  if (idx >= 0) fallingWords.splice(idx, 1)
}

function breachWord(w: FallingWord) {
  lives--
  combo = 0
  multiplier = 1
  breachFlash = 1
  screenShake = 0.5

  playBreachThud()
  spawnBreachParticles(w.x + w.width / 2, H * THRESHOLD_Y_RATIO)

  const idx = fallingWords.indexOf(w)
  if (idx >= 0) fallingWords.splice(idx, 1)

  if (lives <= 0) {
    gameOver()
  }
}

// ── Share score card ─────────────────────────────────────────────

function buildScoreCard(): string {
  const bar = (val: number, max: number, len: number) => {
    const filled = Math.round((Math.min(val, max) / max) * len)
    return '█'.repeat(filled) + '░'.repeat(len - filled)
  }

  const modeLabel = gameMode === 'easy' ? 'Easy' : gameMode === 'hard' ? 'Hard' : 'Normal'

  return [
    `GLYPHFALL ⚡ ${lastGameScore.toLocaleString()} pts`,
    `${bar(lastGameWPM, 100, 12)} ${lastGameWPM} WPM`,
    `🔥 Best combo: ${lastGameCombo}x`,
    `⌨️ Accuracy: ${lastGameAccuracy}%`,
    `⏱️ Survived: ${lastGameSurvivedSecs}s`,
    `📊 Mode: ${modeLabel}`,
    ``,
    `https://aakeeo.github.io/glyphfall/`,
  ].join('\n')
}

shareBtn.addEventListener('click', async () => {
  const text = buildScoreCard()

  // Try native share on mobile, clipboard on desktop
  if (isMobile && navigator.share) {
    try {
      await navigator.share({ text })
      return
    } catch {}
  }

  try {
    await navigator.clipboard.writeText(text)
    shareToast.classList.add('show')
    setTimeout(() => shareToast.classList.remove('show'), 2000)
  } catch {}
})

// ── Game flow ────────────────────────────────────────────────────

function startGame() {
  initAudio()
  state = 'playing'
  score = 0
  combo = 0
  bestCombo = 0
  multiplier = 1
  lives = MAX_LIVES
  wordsCompleted = 0
  startTime = performance.now()
  lastSpawn = performance.now()
  const { baseSpawn } = getSpeedForMode(gameMode)
  spawnInterval = baseSpawn
  comboFlash = 0
  screenShake = 0
  breachFlash = 0
  totalKeystrokes = 0
  wrongKeystrokes = 0
  prevInputLength = 0
  newBestScore = false
  newBestCombo = false
  newBestWPM = false
  fallingWords.length = 0
  particles.length = 0
  scorePopups.length = 0
  input.value = ''

  startScreen.classList.add('hidden')
  gameoverScreen.classList.add('hidden')
  pauseScreen.classList.add('hidden')
  inputWrap.classList.remove('hidden')
  input.focus()
}

function gameOver() {
  state = 'gameover'
  inputWrap.classList.add('hidden')

  const elapsed = (performance.now() - startTime) / 1000
  const wpm = elapsed > 0 ? Math.round((wordsCompleted / elapsed) * 60) : 0
  const accuracy = totalKeystrokes > 0
    ? Math.round(((totalKeystrokes - wrongKeystrokes) / totalKeystrokes) * 100)
    : 100

  // Store for share card
  lastGameScore = score
  lastGameWPM = wpm
  lastGameCombo = bestCombo
  lastGameAccuracy = accuracy
  lastGameSurvivedSecs = Math.round(elapsed)

  saveHighScores(score, bestCombo, wpm)

  document.getElementById('go-score')!.textContent = String(score)
  document.getElementById('go-wpm')!.textContent = String(wpm)
  document.getElementById('go-combo')!.textContent = String(bestCombo)
  document.getElementById('go-accuracy')!.textContent = accuracy + '%'

  const toggleBest = (id: string, isNew: boolean) => {
    const el = document.getElementById(id)
    if (el) el.classList.toggle('hidden', !isNew)
  }
  toggleBest('nb-score', newBestScore)
  toggleBest('nb-combo', newBestCombo)
  toggleBest('nb-wpm', newBestWPM)

  setTimeout(() => {
    gameoverScreen.classList.remove('hidden')
  }, 800)
}

// ── Difficulty selector ──────────────────────────────────────────

const diffBtns = document.querySelectorAll('.diff-btn')
diffBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    diffBtns.forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    gameMode = (btn as HTMLElement).dataset.diff as GameMode
  })
})

startBtn.addEventListener('click', startGame)
restartBtn.addEventListener('click', startGame)
input.addEventListener('input', onInput)

// Keyboard handling
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && (state === 'playing' || state === 'paused')) {
    e.preventDefault()
    if (state === 'playing') {
      state = 'paused'
      pauseTime = performance.now()
      pauseScreen.classList.remove('hidden')
      inputWrap.classList.add('hidden')
    } else {
      const pausedDuration = performance.now() - pauseTime
      startTime += pausedDuration
      lastSpawn += pausedDuration
      state = 'playing'
      pauseScreen.classList.add('hidden')
      inputWrap.classList.remove('hidden')
      input.focus()
    }
    return
  }

  if (state === 'playing' && document.activeElement !== input) {
    input.focus()
  }
  if (state === 'menu' && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault()
    startGame()
  }
  if (state === 'gameover' && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault()
    startGame()
  }
})

// ── Background grid ──────────────────────────────────────────────

function drawGrid(ctx: CanvasRenderingContext2D, time: number) {
  const gridSize = 60
  const pulse = Math.sin(time * 0.001) * 0.3 + 0.7

  ctx.strokeStyle = `rgba(0, 240, 255, ${0.03 * pulse})`
  ctx.lineWidth = 0.5

  for (let x = 0; x < W; x += gridSize) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, H)
    ctx.stroke()
  }

  for (let y = 0; y < H; y += gridSize) {
    const yRatio = y / H
    ctx.strokeStyle = `rgba(0, 240, 255, ${0.02 + yRatio * 0.03})`
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }
}

// ── Threshold line ───────────────────────────────────────────────

function drawThreshold(ctx: CanvasRenderingContext2D, time: number) {
  const y = H * THRESHOLD_Y_RATIO
  const pulse = Math.sin(time * 0.003) * 0.15 + 0.85

  const grad = ctx.createLinearGradient(0, y - 20, 0, y + 20)
  grad.addColorStop(0, 'transparent')
  grad.addColorStop(0.45, `rgba(255, 45, 120, ${0.08 * pulse})`)
  grad.addColorStop(0.5, `rgba(255, 45, 120, ${0.25 * pulse})`)
  grad.addColorStop(0.55, `rgba(255, 45, 120, ${0.08 * pulse})`)
  grad.addColorStop(1, 'transparent')
  ctx.fillStyle = grad
  ctx.fillRect(0, y - 20, W, 40)

  ctx.strokeStyle = `rgba(255, 45, 120, ${0.4 * pulse})`
  ctx.lineWidth = 1
  ctx.setLineDash([12, 8])
  ctx.beginPath()
  ctx.moveTo(0, y)
  ctx.lineTo(W, y)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.fillStyle = `rgba(255, 45, 120, ${0.35 * pulse})`
  ctx.font = '500 9px "Orbitron", sans-serif'
  ctx.letterSpacing = '3px'
  ctx.fillText('THRESHOLD', 16, y - 8)
  ctx.letterSpacing = '0px'
}

// ── HUD ──────────────────────────────────────────────────────────

function drawHUD(ctx: CanvasRenderingContext2D, time: number) {
  const elapsed = (time - startTime) / 1000
  const wpm = elapsed > 0 ? Math.round((wordsCompleted / elapsed) * 60) : 0

  ctx.fillStyle = CYAN
  ctx.shadowColor = CYAN
  ctx.shadowBlur = 10
  ctx.font = FONT_HUD_LARGE
  ctx.textBaseline = 'top'
  ctx.fillText(String(score).padStart(6, '0'), 24, 24)
  ctx.shadowBlur = 0

  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.font = FONT_HUD
  ctx.fillText('SCORE', 24, 48)

  // Lives
  for (let i = 0; i < MAX_LIVES; i++) {
    const lx = W - 24 - (MAX_LIVES - i) * 28
    const ly = 28
    if (i < lives) {
      ctx.fillStyle = MAGENTA
      ctx.shadowColor = MAGENTA
      ctx.shadowBlur = 8
      ctx.beginPath()
      ctx.arc(lx, ly, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
    } else {
      ctx.strokeStyle = 'rgba(255, 45, 120, 0.25)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(lx, ly, 6, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.font = FONT_HUD
  ctx.textBaseline = 'top'
  ctx.textAlign = 'right'
  ctx.fillText('LIVES', W - 24, 48)
  ctx.textAlign = 'left'

  const cx = W / 2
  ctx.textAlign = 'center'

  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.font = FONT_HUD
  ctx.fillText('WPM', cx - 60, 48)
  ctx.fillStyle = '#fff'
  ctx.font = FONT_HUD_LARGE
  ctx.fillText(String(wpm), cx - 60, 24)

  if (combo > 0) {
    const comboColor = combo >= 10 ? AMBER : combo >= 5 ? LIME : CYAN
    ctx.fillStyle = comboColor
    ctx.shadowColor = comboColor
    ctx.shadowBlur = comboFlash > 0 ? 20 : 8
    ctx.font = FONT_HUD_LARGE
    ctx.fillText(`${combo}x`, cx + 60, 24)
    ctx.shadowBlur = 0

    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.font = FONT_HUD
    ctx.fillText('COMBO', cx + 60, 48)

    if (multiplier > 1) {
      ctx.fillStyle = AMBER
      ctx.font = '400 10px "Orbitron", sans-serif'
      ctx.fillText(`×${multiplier.toFixed(1)}`, cx + 60, 62)
    }
  }

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

// ── Draw a falling word ──────────────────────────────────────────

function drawWord(ctx: CanvasRenderingContext2D, w: FallingWord, time: number) {
  const entryScale = Math.min(1, w.entryAnim * 2)
  const alpha = Math.min(1, w.entryAnim * 3)
  if (alpha <= 0) return

  const thresholdY = H * THRESHOLD_Y_RATIO
  const urgency = Math.max(0, Math.min(1, (w.y - thresholdY * 0.4) / (thresholdY * 0.6)))

  ctx.save()
  ctx.globalAlpha = alpha

  const pad = 10
  const boxX = w.x - pad
  const boxY = w.y - pad
  const boxW = w.width + pad * 2
  const boxH = w.height + pad * 2

  ctx.fillStyle = w.active
    ? 'rgba(0, 240, 255, 0.06)'
    : 'rgba(10, 13, 20, 0.7)'

  let borderColor: string
  if (w.active) {
    borderColor = `rgba(0, 240, 255, ${0.4 + Math.sin(time * 0.008) * 0.15})`
  } else if (urgency < 0.5) {
    borderColor = 'rgba(0, 240, 255, 0.12)'
  } else if (urgency < 0.8) {
    const t = (urgency - 0.5) / 0.3
    borderColor = `rgba(${Math.round(255 * t)}, ${Math.round(184 * t + 240 * (1 - t))}, ${Math.round(255 * (1 - t))}, ${0.12 + t * 0.2})`
  } else {
    borderColor = `rgba(255, 45, 120, ${0.3 + Math.sin(time * 0.01) * 0.1})`
  }
  ctx.strokeStyle = borderColor
  ctx.lineWidth = w.active ? 1.5 : urgency > 0.7 ? 1.2 : 0.5

  ctx.beginPath()
  ctx.roundRect(boxX, boxY, boxW * entryScale, boxH, 4)
  ctx.fill()
  ctx.stroke()

  const baselineY = w.y + 18

  if (w.matched > 0) {
    const matchedText = w.text.slice(0, w.matched)
    const remainText = w.text.slice(w.matched)

    ctx.font = w.font
    ctx.fillStyle = CYAN
    ctx.shadowColor = CYAN
    ctx.shadowBlur = w.flash > 0 ? 16 : 8
    ctx.fillText(matchedText, w.x, baselineY)

    const matchedWidth = ctx.measureText(matchedText).width
    ctx.fillStyle = getUrgencyColor(urgency, time, w.x)
    ctx.shadowBlur = 0
    ctx.fillText(remainText, w.x + matchedWidth, baselineY)
  } else {
    ctx.font = w.font
    ctx.fillStyle = getUrgencyColor(urgency, time, w.x)
    ctx.shadowColor = urgency > 0.7 ? 'rgba(255, 45, 120, 0.3)' : 'rgba(0, 240, 255, 0.3)'
    ctx.shadowBlur = 4
    ctx.fillText(w.text, w.x, baselineY)
    ctx.shadowBlur = 0
  }

  const dotColor =
    w.difficulty === 'easy' ? 'rgba(255,255,255,0.2)' :
    w.difficulty === 'medium' ? CYAN : AMBER
  ctx.fillStyle = dotColor
  ctx.beginPath()
  ctx.arc(boxX + boxW * entryScale - 6, boxY + 6, 2, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

function getUrgencyColor(urgency: number, time: number, x: number): string {
  if (urgency < 0.5) {
    return `rgba(255, 255, 255, ${0.65 + Math.sin(time * 0.002 + x) * 0.1})`
  }
  if (urgency < 0.8) {
    const t = (urgency - 0.5) / 0.3
    return `rgba(255, ${Math.round(255 - t * 71)}, ${Math.round(255 - t * 255)}, 0.8)`
  }
  const t = (urgency - 0.8) / 0.2
  return `rgba(255, ${Math.round(184 - t * 139)}, ${Math.round(t * 120)}, 0.9)`
}

// ── Combo burst ──────────────────────────────────────────────────

function drawComboBurst(ctx: CanvasRenderingContext2D) {
  if (comboFlash <= 0) return
  if (combo < 3) return

  ctx.save()
  ctx.globalAlpha = comboFlash * 0.6
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const comboColor = combo >= 10 ? AMBER : combo >= 5 ? LIME : CYAN
  ctx.fillStyle = comboColor
  ctx.shadowColor = comboColor
  ctx.shadowBlur = 30
  ctx.font = FONT_COMBO

  const scale = 1 + (1 - comboFlash) * 0.3
  const cx = W / 2
  const cy = H / 2 - 40

  ctx.translate(cx, cy)
  ctx.scale(scale, scale)
  ctx.fillText(`${combo}×`, 0, 0)

  ctx.font = '400 14px "Orbitron", sans-serif'
  ctx.fillStyle = `rgba(255,255,255,${comboFlash * 0.5})`
  ctx.shadowBlur = 0
  ctx.fillText(
    combo >= 15 ? 'UNSTOPPABLE' :
    combo >= 10 ? 'GODLIKE' :
    combo >= 5 ? 'ON FIRE' :
    'COMBO',
    0, 36
  )

  ctx.restore()
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

function drawBreachFlash(ctx: CanvasRenderingContext2D) {
  if (breachFlash <= 0) return
  ctx.save()
  ctx.fillStyle = `rgba(255, 45, 120, ${breachFlash * 0.15})`
  ctx.fillRect(0, 0, W, H)
  ctx.restore()
}

function drawAtmosphere(ctx: CanvasRenderingContext2D, time: number) {
  const t = time * 0.0002
  const orbX1 = W * (0.3 + Math.sin(t) * 0.2)
  const orbY1 = H * (0.4 + Math.cos(t * 0.7) * 0.2)

  const grad1 = ctx.createRadialGradient(orbX1, orbY1, 0, orbX1, orbY1, 300)
  grad1.addColorStop(0, 'rgba(0, 240, 255, 0.03)')
  grad1.addColorStop(1, 'transparent')
  ctx.fillStyle = grad1
  ctx.fillRect(0, 0, W, H)

  const orbX2 = W * (0.7 + Math.cos(t * 0.5) * 0.15)
  const orbY2 = H * (0.6 + Math.sin(t * 0.8) * 0.15)

  const grad2 = ctx.createRadialGradient(orbX2, orbY2, 0, orbX2, orbY2, 250)
  grad2.addColorStop(0, 'rgba(255, 45, 120, 0.02)')
  grad2.addColorStop(1, 'transparent')
  ctx.fillStyle = grad2
  ctx.fillRect(0, 0, W, H)
}

function drawMenuBg(ctx: CanvasRenderingContext2D, time: number) {
  ctx.fillStyle = VOID
  ctx.fillRect(0, 0, W, H)
  drawAtmosphere(ctx, time)
  drawGrid(ctx, time)

  const ghostWords = ['GLYPH', 'FALL', 'VOID', 'FLUX', 'FLOW', 'SYNC', 'NODE', 'BEAM']
  ctx.globalAlpha = 0.04
  ctx.font = '900 80px "Orbitron", sans-serif'
  ctx.fillStyle = CYAN
  for (let i = 0; i < ghostWords.length; i++) {
    const gx = (W * (0.1 + (i * 0.13) % 0.9) + Math.sin(time * 0.0003 + i) * 40) % W
    const gy = (H * (0.1 + (i * 0.17) % 0.8) + Math.cos(time * 0.0004 + i * 2) * 30) % H
    ctx.fillText(ghostWords[i], gx, gy)
  }
  ctx.globalAlpha = 1
}

// ── Main loop ────────────────────────────────────────────────────

let lastTime = performance.now()

function frame(time: number) {
  const dt = Math.min((time - lastTime) / 1000, 0.05)
  lastTime = time

  resize()

  if (state === 'menu' || state === 'gameover' || state === 'paused') {
    drawMenuBg(ctx, time)
    requestAnimationFrame(frame)
    return
  }

  // Screen shake
  if (screenShake > 0) {
    screenShake -= dt * 3
    screenShakeX = (Math.random() - 0.5) * screenShake * 12
    screenShakeY = (Math.random() - 0.5) * screenShake * 12
  } else {
    screenShakeX = 0
    screenShakeY = 0
  }

  comboFlash = Math.max(0, comboFlash - dt * 2)
  breachFlash = Math.max(0, breachFlash - dt * 3)

  // Spawning
  const elapsed = time - startTime
  const { baseSpawn, minSpawn } = getSpeedForMode(gameMode)
  spawnInterval = Math.max(minSpawn, baseSpawn - elapsed * 0.012)

  if (time - lastSpawn > spawnInterval && fallingWords.length < 12) {
    spawnWord()
    lastSpawn = time
  }

  const thresholdY = H * THRESHOLD_Y_RATIO
  for (let i = fallingWords.length - 1; i >= 0; i--) {
    const w = fallingWords[i]
    w.y += w.speed * dt * 60
    w.entryAnim = Math.min(1, w.entryAnim + dt * 3)
    w.flash = Math.max(0, w.flash - dt * 4)

    if (w.y > thresholdY) {
      breachWord(w)
    }
  }

  updateParticles(dt)
  updateScorePopups(dt)

  // Draw
  ctx.save()
  ctx.translate(screenShakeX, screenShakeY)

  ctx.fillStyle = VOID
  ctx.fillRect(-10, -10, W + 20, H + 20)

  drawAtmosphere(ctx, time)
  drawGrid(ctx, time)
  drawThreshold(ctx, time)

  for (const w of fallingWords) {
    drawWord(ctx, w, time)
  }

  drawParticles(ctx)
  drawScorePopups(ctx)
  drawComboBurst(ctx)
  drawBreachFlash(ctx)
  drawHUD(ctx, time)

  ctx.restore()

  requestAnimationFrame(frame)
}

// ── Boot ─────────────────────────────────────────────────────────

if (isMobile) {
  inputWrap.classList.add('input-top')
}

loadHighScores()

if (document.fonts) {
  document.fonts.ready.then(() => requestAnimationFrame(frame))
} else {
  requestAnimationFrame(frame)
}
