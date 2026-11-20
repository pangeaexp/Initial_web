'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '@/lib/i18n'
import { ACHIEVEMENT_IDS, ACHIEVEMENTS_KEY, earnedAchievements, readAchievements, type AchievementId } from '@/lib/sun-game-achievements'
import { LEADERBOARD_KEY, rankScores, readLeaderboard, type ScoreEntry } from '@/lib/sun-game-leaderboard'
import SunGameLeaderboard from '@/components/SunGameLeaderboard'
import SunHallOfFame from '@/components/SunHallOfFame'
import SunGameCountdown from '@/components/SunGameCountdown'
import SunGameMedals from '@/components/SunGameMedals'
import { positionTableTennisBall, TableTennisBall, TableTennisBallShadow, TableTennisCourt, TableTennisPaddle } from '@/components/TableTennis'
import { advanceTableBall, BASELINE_FLIGHT, baselineRallySpeed, createTableBall, paddleHitsBall, paddlePosition, paddleTransform, returnTableBall, type TableBall } from '@/lib/table-tennis'
import { advanceTableMatch, createTableMatch, MATCH_DIFFICULTIES, MATCH_END_DEPTH, MATCH_SHOTS, MATCH_TARGETS, returnMatchBall, tableMatchStatus, type MatchDifficulty, type MatchShot, type MatchStatus, type MatchTarget, type TableMatch } from '@/lib/table-tennis-match'
import { opponentPaddleTransform } from '@/lib/table-tennis-scene'

type Props = { size?: number; className?: string }
type Phase = 'idle' | 'menu' | 'match-setup' | 'countdown' | 'playing' | 'paused' | 'finished'
type Mode = 'timed' | 'practice' | 'match'
const DURATION = 30
const RECORD_KEY = 'cejoventut.sun-game.best.v1'
const INITIAL_STATS = { hits: 0, misses: 0, points: 0, streak: 0, bestStreak: 0 }
const INITIAL_MATCH_VIEW: { player: number; opponent: number; status: MatchStatus } = { player: 0, opponent: 0, status: 'rally' }
const MATCH_OPTION_STYLE = 'grid min-h-11 place-items-center rounded-xl border border-foreground/20 px-1 text-sm font-semibold peer-checked:border-primary peer-checked:bg-primary/10 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary'
const levelFor = (hits: number) => Math.min(5, 1 + Math.floor(hits / 5))
const multiplierFor = (streak: number) => Math.min(3, 1 + Math.floor(streak / 5))

function readRecord() {
  try {
    const value = Number(localStorage.getItem(RECORD_KEY))
    return Number.isSafeInteger(value) && value >= 0 ? value : 0
  } catch {
    return 0
  }
}

export default function SunBouncing({ size = 40, className }: Props) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<Phase>('idle')
  const [mode, setMode] = useState<Mode>('timed')
  const [matchDifficulty, setMatchDifficulty] = useState<MatchDifficulty>('normal')
  const [matchTarget, setMatchTarget] = useState<MatchTarget>(MATCH_TARGETS[0])
  const [matchShot, setMatchShot] = useState<MatchShot>('flat')
  const [matchView, setMatchView] = useState(INITIAL_MATCH_VIEW)
  const [stats, setStats] = useState(INITIAL_STATS)
  const { hits, misses, points, streak, bestStreak } = stats
  const [remaining, setRemaining] = useState(DURATION)
  const [best, setBest] = useState(0)
  const [feedback, setFeedback] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [newRecord, setNewRecord] = useState(false)
  const [achievements, setAchievements] = useState<AchievementId[]>([])
  const [newAchievements, setNewAchievements] = useState<AchievementId[]>([])
  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([])
  const [currentRank, setCurrentRank] = useState<number | null>(null)
  const [preparationInterrupted, setPreparationInterrupted] = useState(false)
  const [hallOpen, setHallOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const hudRef = useRef<HTMLDivElement>(null)
  const ballRef = useRef<HTMLButtonElement>(null)
  const ballShadowRef = useRef<HTMLSpanElement>(null)
  const courtRef = useRef<HTMLDivElement>(null)
  const paddleRef = useRef<HTMLSpanElement>(null)
  const opponentRef = useRef<HTMLSpanElement>(null)
  const launchRef = useRef<HTMLButtonElement>(null)
  const resumeRef = useRef<HTMLButtonElement>(null)
  const selectedDifficultyRef = useRef<HTMLInputElement>(null)
  const phaseRef = useRef<Phase>('idle')
  const modeRef = useRef<Mode>('timed')
  const motionRef = useRef<TableBall | null>(null)
  const matchRef = useRef<TableMatch | null>(null)
  const ballCentreRef = useRef<ReturnType<typeof positionTableTennisBall> | null>(null)
  const pausedTimeRef = useRef(0)
  const statsRef = useRef(INITIAL_STATS)
  const bestRef = useRef(0)
  const achievementsRef = useRef<AchievementId[]>([])
  const leaderboardRef = useRef<ScoreEntry[]>([])
  const roundFinishedRef = useRef(false)
  const deadlineRef = useRef(0)
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const gameSize = Math.max(44, size)
  const isOpen = phase !== 'idle'
  const settingUpMatch = phase === 'match-setup'
  const hasHud = phase === 'countdown' || phase === 'playing' || phase === 'paused'
  const returnReady = mode === 'match' && phase === 'playing' && matchView.status === 'return'
  const accuracy = hits + misses > 0 ? Math.round(hits / (hits + misses) * 100) : 0

  const changePhase = useCallback((next: Phase) => {
    phaseRef.current = next
    setPhase(next)
  }, [])

  const beginRound = useCallback(() => {
    if (phaseRef.current !== 'countdown') return
    if (document.hidden) { setPreparationInterrupted(true); changePhase('menu'); return }
    deadlineRef.current = modeRef.current === 'timed' ? Date.now() + DURATION * 1000 : Infinity
    changePhase('playing')
  }, [changePhase])

  const finish = useCallback(() => {
    const canFinish = phaseRef.current === 'playing' || (modeRef.current === 'practice' && phaseRef.current === 'paused')
    if (!canFinish || roundFinishedRef.current) return
    roundFinishedRef.current = true
    if (modeRef.current !== 'timed') {
      audioRef.current?.pause()
      setFeedback(0)
      changePhase('finished')
      return
    }
    const previousBest = Math.max(readRecord(), bestRef.current)
    const record = Math.max(previousBest, statsRef.current.points)
    setNewRecord(statsRef.current.points > previousBest)
    bestRef.current = record
    setBest(record)
    audioRef.current?.pause()
    try { localStorage.setItem(RECORD_KEY, String(record)) } catch { /* Storage can be disabled. */ }
    const previousAchievements = new Set([...readAchievements(), ...achievementsRef.current])
    const earned = earnedAchievements(statsRef.current)
    const newlyEarned = earned.filter((id) => !previousAchievements.has(id))
    const unlocked = ACHIEVEMENT_IDS.filter((id) => previousAchievements.has(id) || earned.includes(id))
    achievementsRef.current = unlocked
    setAchievements(unlocked)
    setNewAchievements(newlyEarned)
    try { localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(unlocked)) } catch { /* Keep achievements in memory when storage is disabled. */ }
    const { points, hits, misses, bestStreak } = statsRef.current
    const entry: ScoreEntry = { id: crypto.randomUUID(), points, hits, misses, bestStreak }
    const ranked = rankScores([...readLeaderboard(), ...leaderboardRef.current, entry])
    leaderboardRef.current = ranked
    setLeaderboard(ranked)
    const index = ranked.findIndex((score) => score.id === entry.id)
    setCurrentRank(index >= 0 ? index + 1 : null)
    try { localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(ranked)) } catch { /* Keep rankings in memory when storage is disabled. */ }
    setRemaining(0)
    changePhase('finished')
  }, [changePhase])

  const pause = useCallback(() => {
    if (phaseRef.current !== 'playing') return
    const milliseconds = Math.max(0, deadlineRef.current - Date.now())
    if (milliseconds === 0) { finish(); return }
    pausedTimeRef.current = milliseconds
    if (modeRef.current === 'timed') setRemaining(Math.ceil(milliseconds / 1000))
    setFeedback(0)
    if (feedbackTimer.current !== null) clearTimeout(feedbackTimer.current)
    audioRef.current?.pause()
    changePhase('paused')
  }, [changePhase, finish])

  const resume = () => {
    if (phaseRef.current !== 'paused' || document.hidden) return
    deadlineRef.current = Date.now() + pausedTimeRef.current
    const match = matchRef.current
    if (match) setMatchView({ ...match.score, status: tableMatchStatus(match) })
    changePhase('playing')
  }

  const exit = () => {
    audioRef.current?.pause()
    changePhase('idle')
  }

  useEffect(() => {
    const onVisibilityChange = () => {
      if (!document.hidden) return
      if (phaseRef.current === 'countdown') { setPreparationInterrupted(true); changePhase('menu') }
      else pause()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [pause, changePhase])

  useEffect(() => {
    if (phase === 'paused') resumeRef.current?.focus({ preventScroll: true })
    if (phase === 'match-setup') selectedDifficultyRef.current?.focus({ preventScroll: true })
  }, [phase])

  useEffect(() => {
    if (!isOpen) return
    const dialog = dialogRef.current
    const launch = launchRef.current
    dialog?.showModal()
    return () => { dialog?.close(); launch?.focus({ preventScroll: true }) }
  }, [isOpen])

  useEffect(() => {
    if (!hasHud) return
    const dialog = dialogRef.current
    const hud = hudRef.current
    const updateLayout = () => {
      if (hud) dialog?.style.setProperty('--sun-game-hud-height', `${hud.getBoundingClientRect().height}px`)
    }
    updateLayout()
    const observer = new ResizeObserver(updateLayout)
    if (hud) observer.observe(hud)
    return () => {
      observer.disconnect()
    }
  }, [hasHud])

  useEffect(() => {
    if (phase !== 'playing') return
    const ball = ballRef.current
    if (!ball) return
    ball.focus({ preventScroll: true })
    const match = matchRef.current
    if (!motionRef.current) {
      const width = courtRef.current?.clientWidth || window.innerWidth
      const height = courtRef.current?.clientHeight || Math.max(160, window.innerHeight - 200)
      motionRef.current = match?.ball ?? createTableBall(Math.PI / 4 + Math.random() * Math.PI / 2, -1, BASELINE_FLIGHT)
      if (paddleRef.current) paddleRef.current.style.transform = paddleTransform(width / 2, height - 70, width, height)
    }
    const motion = motionRef.current
    let matchStatus = match ? tableMatchStatus(match) : 'rally'
    const renderBall = () => {
      const width = courtRef.current?.clientWidth || window.innerWidth
      const height = courtRef.current?.clientHeight || Math.max(160, window.innerHeight - 200)
      const currentBall = match?.ball ?? motion
      ballCentreRef.current = positionTableTennisBall(ball, ballShadowRef.current, currentBall, width, height, gameSize)
      if (opponentRef.current) {
        opponentRef.current.style.transform = match
          ? opponentPaddleTransform(match.opponentX, width, height, match.opponentY, MATCH_END_DEPTH)
          : opponentPaddleTransform(currentBall.x, width, height)
      }
    }
    renderBall()
    let previous = performance.now()
    let animation = 0

    const step = (now: number) => {
      if (phaseRef.current !== 'playing') return
      if (modeRef.current === 'timed') {
        const seconds = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000))
        setRemaining((value) => value === seconds ? value : seconds)
        if (seconds === 0) { finish(); return }
      }
      // Delta time keeps the same speed on different refresh rates.
      const dt = Math.min((now - previous) / 1000, 0.05)
      previous = now
      if (match) {
        advanceTableMatch(match, dt)
        const status = tableMatchStatus(match)
        if (matchStatus !== status) {
          matchStatus = status
          setMatchView({ ...match.score, status })
        }
        if (match.winner) { finish(); return }
      } else {
        const speedBonus = (levelFor(statsRef.current.hits) - 1) * 0.15
        advanceTableBall(motion, dt * baselineRallySpeed(motion, speedBonus), BASELINE_FLIGHT)
      }
      renderBall()
      animation = requestAnimationFrame(step)
    }
    animation = requestAnimationFrame(step)
    return () => cancelAnimationFrame(animation)
  }, [phase, gameSize, finish])

  useEffect(() => () => {
    if (feedbackTimer.current !== null) clearTimeout(feedbackTimer.current)
    audioRef.current?.pause()
  }, [])

  const loadProgress = () => {
    bestRef.current = Math.max(readRecord(), bestRef.current)
    setBest(bestRef.current)
    const savedAchievements = readAchievements()
    achievementsRef.current = ACHIEVEMENT_IDS.filter((id) => achievementsRef.current.includes(id) || savedAchievements.includes(id))
    setAchievements(achievementsRef.current)
    leaderboardRef.current = rankScores([...readLeaderboard(), ...leaderboardRef.current])
    setLeaderboard(leaderboardRef.current)
  }

  const openMenu = () => {
    loadProgress()
    setPreparationInterrupted(false)
    changePhase('menu')
  }

  const start = (nextMode: Mode) => {
    modeRef.current = nextMode
    setMode(nextMode)
    roundFinishedRef.current = false
    motionRef.current = null
    matchRef.current = nextMode === 'match' ? createTableMatch(Math.PI / 4 + Math.random() * Math.PI / 2, matchDifficulty, matchTarget) : null
    setMatchShot('flat')
    setMatchView(INITIAL_MATCH_VIEW)
    ballCentreRef.current = null
    pausedTimeRef.current = 0
    statsRef.current = INITIAL_STATS
    deadlineRef.current = Infinity
    setStats(INITIAL_STATS)
    setRemaining(DURATION)
    loadProgress()
    setNewRecord(false)
    setNewAchievements([])
    setPreparationInterrupted(false)
    setCurrentRank(null)
    setFeedback(0)
    if (feedbackTimer.current !== null) clearTimeout(feedbackTimer.current)
    if (!audioRef.current) {
      audioRef.current = new Audio('/sounds/pop.mp3')
      audioRef.current.volume = 0.4
    }
    changePhase('countdown')
  }

  const playHitSound = () => {
    const audio = audioRef.current
    if (audio && soundEnabled) {
      try { audio.currentTime = 0; void audio.play().catch(() => {}) } catch { /* Sound is optional. */ }
    }
  }

  const hit = (offset = 0, shot = matchShot) => {
    if (phaseRef.current !== 'playing') return
    if (Date.now() >= deadlineRef.current) { finish(); return }
    if (matchRef.current) {
      if (returnMatchBall(matchRef.current, offset, shot)) playHitSound()
      return
    }
    if (motionRef.current) {
      returnTableBall(motionRef.current, offset, BASELINE_FLIGHT)
    }
    const previous = statsRef.current
    const nextStreak = previous.streak + 1
    const earned = multiplierFor(nextStreak)
    const next = {
      hits: previous.hits + 1,
      misses: previous.misses,
      points: previous.points + earned,
      streak: nextStreak,
      bestStreak: Math.max(previous.bestStreak, nextStreak),
    }
    statsRef.current = next
    setStats(next)
    setFeedback(earned)
    if (feedbackTimer.current !== null) clearTimeout(feedbackTimer.current)
    feedbackTimer.current = setTimeout(() => setFeedback(0), 450)
    playHitSound()
  }

  const miss = () => {
    if (phaseRef.current !== 'playing' || modeRef.current === 'match') return
    if (Date.now() >= deadlineRef.current) { finish(); return }
    const next = { ...statsRef.current, misses: statsRef.current.misses + 1, streak: 0 }
    statsRef.current = next
    setStats(next)
    setFeedback(0)
  }

  const toggleSound = () => {
    setSoundEnabled(!soundEnabled)
    if (soundEnabled) audioRef.current?.pause()
  }

  const movePaddle = (clientX: number, clientY: number) => {
    if (phaseRef.current !== 'playing' || !courtRef.current || !paddleRef.current) return
    const court = courtRef.current, rect = court.getBoundingClientRect()
    const point = paddlePosition(clientX - rect.left - court.clientLeft, clientY - rect.top - court.clientTop,
      court.clientWidth || window.innerWidth, court.clientHeight || Math.max(160, window.innerHeight - 200))
    paddleRef.current.style.transform = point.transform
    return point
  }

  const keyboardReturn = (offset = 0, shot = matchShot) => {
    if (matchRef.current && tableMatchStatus(matchRef.current) !== 'return') return
    const ball = ballCentreRef.current, court = courtRef.current
    if (ball && court && paddleRef.current) {
      paddleRef.current.style.transform = paddleTransform(ball.x + ball.radius * offset, ball.y,
        court.clientWidth || window.innerWidth, court.clientHeight || Math.max(160, window.innerHeight - 200))
    }
    hit(offset, shot)
  }

  return (
    <div className={`relative inline-flex select-none ${className ?? ''}`}>
      <button ref={launchRef} type="button" onClick={openMenu} aria-label={t('sunGame.play')} aria-haspopup="dialog" aria-expanded={isOpen} className="grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
        <span aria-hidden="true" className={!isOpen ? 'motion-safe:animate-bounce' : undefined} style={{ width: size, height: size }}>
          <TableTennisPaddle className="h-full w-full" />
        </span>
      </button>
      {phase !== 'idle' && createPortal(
        <dialog ref={dialogRef} aria-labelledby="sun-game-title" onCancel={(event) => {
          event.preventDefault()
          if (settingUpMatch) changePhase('menu')
          else exit()
        }} onPointerDown={(event) => {
          // Only contact with the playfield breaks a combo, never release or HUD controls.
          if (event.button === 0 && event.target === event.currentTarget) miss()
        }} className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden border-0 bg-background/20 p-0 text-foreground backdrop:bg-black/10">
          {phase === 'menu' || settingUpMatch ? (
            <div className={`h-full overflow-y-auto px-3 py-4 sm:py-6 ${hallOpen ? 'opacity-0' : ''}`}>
              <section className="mx-auto w-full max-w-sm rounded-2xl border border-primary/20 bg-background px-4 py-3 shadow-xl">
                <div className="flex items-center justify-between gap-3">
                  <h2 id="sun-game-title" className="text-lg font-bold">{t(settingUpMatch ? 'sunGame.match.title' : 'sunGame.menu.title')}</h2>
                  <button type="button" onClick={settingUpMatch ? () => changePhase('menu') : exit} className="min-h-11 rounded-full border border-foreground/20 px-3 text-sm focus-visible:outline-2 focus-visible:outline-primary">{t(settingUpMatch ? 'sunGame.match.back' : 'sunGame.exit')}</button>
                </div>
                {settingUpMatch ? (
                  <form className="mt-2 grid gap-3" onSubmit={(event) => { event.preventDefault(); start('match') }}>
                    <fieldset aria-describedby="sun-match-difficulty-description">
                      <legend className="mb-2 text-sm font-semibold">{t('sunGame.match.difficulty.label')}</legend>
                      <div className="grid grid-cols-3 gap-2">
                        {MATCH_DIFFICULTIES.map((difficulty) => (
                          <label key={difficulty} className="cursor-pointer">
                            <input
                              ref={difficulty === matchDifficulty ? selectedDifficultyRef : undefined}
                              type="radio"
                              name="sun-match-difficulty"
                              value={difficulty}
                              checked={difficulty === matchDifficulty}
                              onChange={() => setMatchDifficulty(difficulty)}
                              className="peer sr-only"
                            />
                            <span className={MATCH_OPTION_STYLE}>
                              {t(`sunGame.match.difficulty.${difficulty}`)}
                            </span>
                          </label>
                        ))}
                      </div>
                      <p id="sun-match-difficulty-description" className="mt-2 text-xs text-foreground/70">
                        {t(`sunGame.match.difficulty.description.${matchDifficulty}`)}
                      </p>
                    </fieldset>
                    <fieldset>
                      <legend className="mb-2 text-sm font-semibold">{t('sunGame.match.pointsPerGame')}</legend>
                      <div className="grid grid-cols-2 gap-2">
                        {MATCH_TARGETS.map((target) => (
                          <label key={target} className="cursor-pointer">
                            <input type="radio" name="sun-match-target" value={target} checked={target === matchTarget} onChange={() => setMatchTarget(target)} className="peer sr-only" />
                            <span className={MATCH_OPTION_STYLE}>{target}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <button type="submit" className="min-h-11 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{t('sunGame.match.start')}</button>
                  </form>
                ) : (
                  <>
                    <p className="mt-1.5 text-sm text-foreground/70">{t('sunGame.menu.hint')}</p>
                    {preparationInterrupted && <p role="status" className="mt-2 text-sm font-semibold">{t('sunGame.menu.interrupted')}</p>}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => start('timed')} className="min-h-11 rounded-xl bg-primary px-2 py-2 text-sm font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{t('sunGame.menu.timed')}</button>
                      <button type="button" onClick={() => changePhase('match-setup')} className="min-h-11 rounded-xl border border-primary/50 px-2 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{t('sunGame.match.title')}</button>
                      <button type="button" onClick={() => start('practice')} className="min-h-11 rounded-xl border border-foreground/20 px-2 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{t('sunGame.practice.play')}</button>
                      <SunHallOfFame onOpenChange={setHallOpen} className="min-h-11 rounded-xl border border-primary/30 px-2 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" />
                    </div>
                    <details className="mt-3 border-t border-foreground/10">
                      <summary className="min-h-11 cursor-pointer rounded-lg py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary">{t('sunGame.menu.progress')}</summary>
                      <p className="text-sm font-semibold">{t('sunGame.best', { count: best })}</p>
                      <SunGameLeaderboard entries={leaderboard} currentRank={null} />
                      <SunGameMedals achievements={achievements} />
                    </details>
                  </>
                )}
              </section>
            </div>
          ) : <>
          {hasHud && <div ref={hudRef} className="absolute inset-x-0 top-0 z-10 grid gap-1 border-b border-foreground/10 bg-background/90 px-3 py-2 backdrop-blur-sm sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <div>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <h2 id="sun-game-title" className="text-sm font-bold">{t(mode === 'match' ? 'sunGame.match.title' : mode === 'practice' ? 'sunGame.practice.title' : 'sunGame.title')}</h2>
                  {mode === 'match' && <span className="text-xs font-semibold text-foreground/70">{t(`sunGame.match.difficulty.${matchDifficulty}`)}</span>}
                </div>
                <p className="text-xs text-foreground/70">
                  {mode === 'match' ? t('sunGame.match.instructions', { target: matchTarget }) : t(mode === 'practice' ? 'sunGame.practice.instructions' : 'sunGame.instructions')}
                  {mode === 'match' && <span id="sun-match-keyboard" className="sr-only sm:not-sr-only"> {t('sunGame.match.keyboard')}</span>}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {mode === 'practice' && (phase === 'playing' || phase === 'paused') && <button type="button" onClick={finish} className="min-h-11 rounded-lg border border-primary/40 px-2.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-primary">{t('sunGame.practice.finish')}</button>}
                {(phase === 'playing' || phase === 'paused') && <button type="button" onClick={pause} disabled={phase === 'paused'} className="min-h-11 rounded-lg border border-foreground/20 px-2.5 text-xs disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary">{t('sunGame.pause')}</button>}
                <button type="button" onClick={toggleSound} aria-label={t('sunGame.sound')} aria-pressed={soundEnabled} className="min-h-11 rounded-lg border border-foreground/20 px-2.5 text-xs focus-visible:outline-2 focus-visible:outline-primary">{t(soundEnabled ? 'sunGame.soundOn' : 'sunGame.soundOff')}</button>
                <button type="button" onClick={exit} className="min-h-11 min-w-11 rounded-lg border border-foreground/20 px-2.5 text-xs focus-visible:outline-2 focus-visible:outline-primary">{t('sunGame.exit')}</button>
              </div>
            </div>
            {mode === 'match' ? (
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-bold tabular-nums">
                  <span>{t('sunGame.match.playerScore', { count: matchView.player })}</span>
                  <span>{t('sunGame.match.opponentScore', { count: matchView.opponent })}</span>
                  <span role="status" className={`rounded-md px-2 py-0.5 text-xs font-semibold ${returnReady ? 'bg-emerald-300 text-emerald-950' : 'bg-foreground/10'}`}>
                    {t(`sunGame.match.status.${matchView.status}`)}
                  </span>
                </div>
                <div role="group" aria-label={t('sunGame.match.shot.label')} className="flex flex-wrap gap-1">
                  {MATCH_SHOTS.map((shot) => (
                    <button
                      key={shot}
                      type="button"
                      aria-pressed={shot === matchShot}
                      onClick={(event) => {
                        setMatchShot(shot)
                        if (event.detail !== 0 && phaseRef.current === 'playing') ballRef.current?.focus({ preventScroll: true })
                      }}
                      className="min-h-11 rounded-lg border border-foreground/20 px-2.5 text-xs font-semibold aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      {t(`sunGame.match.shot.${shot}`)}
                      {shot !== 'flat' && <span aria-hidden="true" className="ml-1">{shot === 'topspin' ? '↑' : '↓'}</span>}
                    </button>
                  ))}
                </div>
              </div>
            ) : <div className="grid grid-cols-3 items-baseline gap-x-2 gap-y-0.5 text-xs font-semibold tabular-nums sm:flex sm:flex-wrap sm:gap-x-5">
              <span role="status" aria-live="polite">{t('sunGame.points', { count: points })}</span>
              <span aria-live="off" className={mode === 'timed' && remaining <= 5 ? 'text-red-500' : ''}>{mode === 'practice' ? t('sunGame.practice.unlimited') : t('sunGame.time', { seconds: remaining })}</span>
              <span>{mode === 'practice' ? t('sunGame.practice.badge') : t('sunGame.best', { count: best })}</span>
              <span>{t('footer.sunHits', { count: hits })}</span>
              <span className={streak >= 5 ? 'text-primary' : ''}>{t('sunGame.combo', { count: streak, multiplier: multiplierFor(streak) })}</span>
              <span>{t('sunGame.level', { level: levelFor(hits) })}</span>
            </div>}
            {mode === 'timed' && <div className="flex items-center gap-2">
              <div role="progressbar" aria-label={t('sunGame.timeRemaining')} aria-valuemin={0} aria-valuemax={DURATION} aria-valuenow={remaining} aria-valuetext={t('sunGame.time', { seconds: remaining })} className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-foreground/10">
                <div className={`h-full origin-left rounded-full transition-transform duration-300 motion-reduce:transition-none ${remaining <= 5 ? 'bg-red-500' : 'bg-primary'}`} style={{ transform: `scaleX(${remaining / DURATION})` }} />
              </div>
              {phase === 'playing' && remaining <= 5 && <p role="status" className="text-xs font-bold text-red-500">{t('sunGame.lastSeconds')}</p>}
            </div>}
          </div>}
          {hasHud ? (
            <div ref={courtRef} role="region" aria-label={t('sunGame.table.label')} onPointerMove={(event) => movePaddle(event.clientX, event.clientY)} onPointerDown={(event) => {
              if (event.button !== 0) return
              const contact = movePaddle(event.clientX, event.clientY)
              const ball = ballCentreRef.current
              if (!contact || !ball) return
              const tolerance = mode === 'match' ? (event.pointerType === 'touch' ? 18 : 10) : undefined
              if (paddleHitsBall(contact, ball, tolerance)) hit((contact.x - ball.x) / ball.radius)
              else miss()
            }} className={`absolute inset-x-4 bottom-4 top-[calc(var(--sun-game-hud-height,200px)+0.5rem)] overflow-hidden rounded-2xl border border-white/70 bg-[#0c544d]/85 shadow-xl ${phase === 'playing' ? 'cursor-none touch-none' : ''}`}>
            <TableTennisCourt />
            <TableTennisBallShadow ref={ballShadowRef} />
            <span ref={opponentRef} aria-hidden="true" hidden={phase === 'countdown'} className="pointer-events-none absolute left-0 top-0"><TableTennisPaddle opponent /></span>
            <span ref={paddleRef} aria-hidden="true" hidden={phase === 'countdown'} className="pointer-events-none absolute left-0 top-0"><TableTennisPaddle /></span>
            {phase === 'countdown' ? <div className="absolute inset-0 z-10 flex items-center justify-center p-4"><SunGameCountdown onComplete={beginRound} /></div> : <>
            <button
              ref={ballRef}
              type="button"
              disabled={phase === 'paused'}
              onClick={(event) => {
                // Keyboard and assistive technology activate without a pointer.
                if (event.detail === 0) keyboardReturn()
              }}
              onKeyDown={(event) => {
                if (mode !== 'match' || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
                event.preventDefault()
                if (event.repeat) return
                if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                  keyboardReturn(0, event.key === 'ArrowUp' ? 'topspin' : 'backspin')
                } else {
                  keyboardReturn(event.key === 'ArrowLeft' ? -1 : 1)
                }
              }}
              aria-label={t('sunGame.catch')}
              aria-describedby={mode === 'match' ? 'sun-match-keyboard' : undefined}
              className={`absolute left-0 top-0 cursor-none touch-none rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white ${returnReady ? 'ring-2 ring-emerald-300/90' : ''} ${feedback ? 'bg-white/10 ring-4 ring-white/40' : ''}`}
              style={{ width: gameSize, height: gameSize }}
            >
              <TableTennisBall />
              {feedback > 0 && <span key={hits} aria-hidden="true" className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 text-xl font-black text-white motion-safe:animate-bounce">+{feedback}</span>}
            </button>
            {phase === 'paused' && (
              <div className="absolute inset-0 z-20 overflow-y-auto bg-background/40 p-3">
                <div className="mx-auto grid w-full max-w-72 gap-2 rounded-2xl border border-primary/20 bg-background px-3 py-2.5 text-center shadow-xl">
                  <h3 className="text-lg font-bold">{t('sunGame.paused')}</h3>
                  <p className="text-xs text-foreground/70">{t('sunGame.pauseHint')}</p>
                  <button ref={resumeRef} type="button" onClick={resume} className="min-h-11 justify-self-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{t('sunGame.resume')}</button>
                </div>
              </div>
            )}
            </>
            }
            </div>
          ) : (
            <div className="h-full overflow-y-auto px-3 py-4 sm:py-6">
              <div className="mx-auto w-full max-w-sm rounded-2xl border border-primary/20 bg-background px-4 py-3 shadow-xl">
                <div className="flex items-center justify-between gap-2">
                  <h2 id="sun-game-title" className="text-lg font-bold outline-none" tabIndex={-1} ref={(node) => node?.focus({ preventScroll: true })}>
                    {t(mode === 'match' ? (matchView.player > matchView.opponent ? 'sunGame.match.won' : 'sunGame.match.lost') : mode === 'practice' ? 'sunGame.practice.finished' : 'sunGame.finished')}
                  </h2>
                  <button type="button" onClick={exit} className="min-h-11 shrink-0 rounded-full border border-foreground/20 px-3 text-sm focus-visible:outline-2 focus-visible:outline-primary">{t('sunGame.exit')}</button>
                </div>
                {mode === 'match' ? (
                  <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-lg font-bold tabular-nums">
                    <p>{t('sunGame.match.playerScore', { count: matchView.player })}</p>
                    <p>{t('sunGame.match.opponentScore', { count: matchView.opponent })}</p>
                  </div>
                ) : <>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="text-2xl font-black tabular-nums">{t('sunGame.points', { count: points })}</p>
                  {newRecord && <p role="status" className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-bold text-primary">{t('sunGame.newRecord')}</p>}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg bg-foreground/5 px-2.5 py-2 text-sm text-foreground/70 tabular-nums">
                  <p>{t('footer.sunHits', { count: hits })}</p>
                  <p>{t('sunGame.misses', { count: misses })}</p>
                  <p className="font-semibold text-foreground">{t('sunGame.accuracy', { percent: accuracy })}</p>
                  <p>{t('sunGame.bestStreak', { count: bestStreak })}</p>
                </div>
                {mode === 'timed' ? (
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    <p className="text-foreground/70">{t('sunGame.best', { count: best })}</p>
                    <p role="status" className="font-semibold">{currentRank !== null ? t('sunGame.leaderboard.position', { rank: currentRank }) : t('sunGame.leaderboard.notRanked')}</p>
                    {newAchievements.length > 0 && <p role="status" className="font-semibold text-primary">{t('sunGame.medals.earned', { count: newAchievements.length })}</p>}
                  </div>
                ) : <p className="mt-2 text-xs text-foreground/70">{t('sunGame.practice.notice')}</p>}
                </>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => start(mode)} className="min-h-11 flex-1 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{t(mode === 'practice' ? 'sunGame.practice.replay' : 'sunGame.replay')}</button>
                  {mode === 'match' && <button type="button" onClick={() => changePhase('match-setup')} className="min-h-11 rounded-xl border border-foreground/20 px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{t('sunGame.match.options')}</button>}
                  {mode === 'practice' && <button type="button" onClick={() => start('timed')} className="min-h-11 flex-1 rounded-xl border border-foreground/20 px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{t('sunGame.practice.timed')}</button>}
                  <button type="button" onClick={toggleSound} aria-label={t('sunGame.sound')} aria-pressed={soundEnabled} className="min-h-11 rounded-xl border border-foreground/20 px-3 text-sm focus-visible:outline-2 focus-visible:outline-primary">{t(soundEnabled ? 'sunGame.soundOn' : 'sunGame.soundOff')}</button>
                </div>
                {mode === 'timed' && <>
                  <SunGameLeaderboard entries={leaderboard} currentRank={currentRank} />
                  <SunGameMedals achievements={achievements} newAchievements={newAchievements} />
                </>}
              </div>
            </div>
          )}
          </>}
        </dialog>, document.body,
      )}
    </div>
  )
}
