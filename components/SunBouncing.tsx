'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '@/lib/i18n'
import { ACHIEVEMENT_IDS, ACHIEVEMENTS_KEY, earnedAchievements, readAchievements, type AchievementId } from '@/lib/sun-game-achievements'
import { LEADERBOARD_KEY, rankScores, readLeaderboard, type ScoreEntry } from '@/lib/sun-game-leaderboard'
import SunGameLeaderboard from '@/components/SunGameLeaderboard'
import SunHallOfFame from '@/components/SunHallOfFame'

type Props = { size?: number; className?: string }
type Phase = 'idle' | 'playing' | 'paused' | 'finished'
type Mode = 'timed' | 'practice'
type Motion = { x: number; y: number; vx: number; vy: number }
const DURATION = 30
const RECORD_KEY = 'cejoventut.sun-game.best.v1'
const INITIAL_STATS = { hits: 0, misses: 0, points: 0, streak: 0, bestStreak: 0 }
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
  const dialogRef = useRef<HTMLDialogElement>(null)
  const hudRef = useRef<HTMLDivElement>(null)
  const ballRef = useRef<HTMLButtonElement>(null)
  const launchRef = useRef<HTMLButtonElement>(null)
  const practiceLaunchRef = useRef<HTMLButtonElement>(null)
  const resumeRef = useRef<HTMLButtonElement>(null)
  const phaseRef = useRef<Phase>('idle')
  const modeRef = useRef<Mode>('timed')
  const motionRef = useRef<Motion | null>(null)
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
  const accuracy = hits + misses > 0 ? Math.round(hits / (hits + misses) * 100) : 0

  const changePhase = useCallback((next: Phase) => {
    phaseRef.current = next
    setPhase(next)
  }, [])

  const finish = useCallback(() => {
    const canFinish = phaseRef.current === 'playing' || (modeRef.current === 'practice' && phaseRef.current === 'paused')
    if (!canFinish || roundFinishedRef.current) return
    roundFinishedRef.current = true
    if (modeRef.current === 'practice') {
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
    changePhase('playing')
  }

  const exit = () => {
    audioRef.current?.pause()
    changePhase('idle')
  }

  useEffect(() => {
    const onVisibilityChange = () => { if (document.hidden) pause() }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [pause])

  useEffect(() => {
    if (phase === 'paused') resumeRef.current?.focus({ preventScroll: true })
  }, [phase])

  useEffect(() => {
    if (!isOpen) return
    const dialog = dialogRef.current
    const launch = modeRef.current === 'practice' ? practiceLaunchRef.current : launchRef.current
    dialog?.showModal()
    const hud = hudRef.current
    const updateLayout = () => {
      if (hud) dialog?.style.setProperty('--sun-game-hud-height', `${hud.getBoundingClientRect().height}px`)
    }
    updateLayout()
    const observer = new ResizeObserver(updateLayout)
    if (hud) observer.observe(hud)
    return () => {
      observer.disconnect()
      dialog?.close()
      launch?.focus({ preventScroll: true })
    }
  }, [isOpen])

  useEffect(() => {
    if (phase !== 'playing') return
    const ball = ballRef.current
    if (!ball) return
    ball.focus({ preventScroll: true })
    if (!motionRef.current) {
      const angle = Math.PI / 4 + Math.random() * Math.PI / 2
      motionRef.current = {
        x: Math.max(16, (window.innerWidth - gameSize) / 2),
        y: Math.max(140, window.innerHeight / 2),
        vx: Math.cos(angle) * 220,
        vy: Math.sin(angle) * 220,
      }
    }
    const motion = motionRef.current
    ball.style.transform = `translate3d(${motion.x}px, ${motion.y}px, 0)`
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
      const maxX = Math.max(8, window.innerWidth - gameSize - 8)
      const hudBottom = hudRef.current?.getBoundingClientRect().bottom ?? 132
      const minY = Math.min(hudBottom + 8, Math.max(8, window.innerHeight - gameSize - 8))
      const maxY = Math.max(minY, window.innerHeight - gameSize - 16)
      const speed = 1 + (levelFor(statsRef.current.hits) - 1) * 0.15
      motion.x += motion.vx * dt * speed
      motion.y += motion.vy * dt * speed
      if (motion.x <= 8 || motion.x >= maxX) { motion.x = Math.max(8, Math.min(motion.x, maxX)); motion.vx *= -1 }
      if (motion.y <= minY || motion.y >= maxY) { motion.y = Math.max(minY, Math.min(motion.y, maxY)); motion.vy *= -1 }
      ball.style.transform = `translate3d(${motion.x}px, ${motion.y}px, 0)`
      animation = requestAnimationFrame(step)
    }
    animation = requestAnimationFrame(step)
    return () => cancelAnimationFrame(animation)
  }, [phase, gameSize, finish])

  useEffect(() => () => {
    if (feedbackTimer.current !== null) clearTimeout(feedbackTimer.current)
    audioRef.current?.pause()
  }, [])

  const start = (nextMode: Mode) => {
    modeRef.current = nextMode
    setMode(nextMode)
    roundFinishedRef.current = false
    motionRef.current = null
    pausedTimeRef.current = 0
    statsRef.current = INITIAL_STATS
    deadlineRef.current = nextMode === 'timed' ? Date.now() + DURATION * 1000 : Infinity
    setStats(INITIAL_STATS)
    setRemaining(DURATION)
    bestRef.current = Math.max(readRecord(), bestRef.current)
    setBest(bestRef.current)
    setNewRecord(false)
    const savedAchievements = readAchievements()
    achievementsRef.current = ACHIEVEMENT_IDS.filter((id) => achievementsRef.current.includes(id) || savedAchievements.includes(id))
    setAchievements(achievementsRef.current)
    setNewAchievements([])
    leaderboardRef.current = rankScores([...readLeaderboard(), ...leaderboardRef.current])
    setLeaderboard(leaderboardRef.current)
    setCurrentRank(null)
    setFeedback(0)
    if (feedbackTimer.current !== null) clearTimeout(feedbackTimer.current)
    if (!audioRef.current) {
      audioRef.current = new Audio('/sounds/pop.mp3')
      audioRef.current.volume = 0.4
    }
    changePhase('playing')
  }

  const hit = () => {
    if (phaseRef.current !== 'playing') return
    if (Date.now() >= deadlineRef.current) { finish(); return }
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
    const audio = audioRef.current
    if (audio && soundEnabled) {
      try { audio.currentTime = 0; void audio.play().catch(() => {}) } catch { /* Sound is optional. */ }
    }
  }

  const miss = () => {
    if (phaseRef.current !== 'playing') return
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

  return (
    <div className={`relative inline-flex max-w-[calc(100vw-4rem)] flex-wrap items-center justify-end gap-2 select-none ${className ?? ''}`}>
      <button ref={launchRef} type="button" onClick={() => start('timed')} className="flex items-center gap-2 rounded-full bg-background/95 px-3 py-2 text-sm font-semibold text-foreground shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/sun/sol6.png" alt="" width={size} height={size} draggable={false} className="motion-safe:animate-bounce" />
        {t('sunGame.play')}
      </button>
      <button ref={practiceLaunchRef} type="button" onClick={() => start('practice')} title={t('sunGame.practice.notice')} className="rounded-full border border-foreground/20 bg-background/95 px-3 py-2 text-sm font-semibold text-foreground shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">{t('sunGame.practice.play')}</button>
      <SunHallOfFame />
      {phase !== 'idle' && createPortal(
        <dialog ref={dialogRef} aria-labelledby="sun-game-title" onCancel={(event) => { event.preventDefault(); exit() }} onPointerDown={(event) => {
          // Only contact with the playfield breaks a combo, never release or HUD controls.
          if (event.button === 0 && event.target === event.currentTarget) miss()
        }} className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden border-0 bg-background/20 p-0 text-foreground backdrop:bg-black/10">
          <div ref={hudRef} className="absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-foreground/10 bg-background/90 px-4 py-4 backdrop-blur-sm sm:px-8">
            <div>
              <h2 id="sun-game-title" className="text-lg font-bold">{t(mode === 'practice' ? 'sunGame.practice.title' : 'sunGame.title')}</h2>
              <p className="text-xs text-foreground/70">{t(mode === 'practice' ? 'sunGame.practice.instructions' : 'sunGame.instructions')}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {mode === 'practice' && (phase === 'playing' || phase === 'paused') && <button type="button" onClick={finish} className="rounded-full border border-primary/40 px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary">{t('sunGame.practice.finish')}</button>}
              {(phase === 'playing' || phase === 'paused') && <button type="button" onClick={pause} disabled={phase === 'paused'} className="rounded-full border border-foreground/20 px-3 py-2 text-sm disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary">{t('sunGame.pause')}</button>}
              <button type="button" onClick={toggleSound} aria-label={t('sunGame.sound')} aria-pressed={soundEnabled} className="rounded-full border border-foreground/20 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary">{t(soundEnabled ? 'sunGame.soundOn' : 'sunGame.soundOff')}</button>
              <button type="button" onClick={exit} className="rounded-full border border-foreground/20 px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary">{t('sunGame.exit')}</button>
            </div>
            <div className="grid w-full grid-cols-3 gap-2 text-sm font-semibold tabular-nums">
              <span role="status" aria-live="polite">{t('sunGame.points', { count: points })}</span>
              <span aria-live="off" className={mode === 'timed' && remaining <= 5 ? 'text-red-600' : ''}>{mode === 'practice' ? t('sunGame.practice.unlimited') : t('sunGame.time', { seconds: remaining })}</span>
              <span>{mode === 'practice' ? t('sunGame.practice.badge') : t('sunGame.best', { count: best })}</span>
            </div>
            <div className="flex w-full flex-wrap justify-between gap-x-3 gap-y-1 text-xs font-semibold tabular-nums">
              <span>{t('footer.sunHits', { count: hits })}</span>
              <span className={streak >= 5 ? 'text-primary' : ''}>{t('sunGame.combo', { count: streak, multiplier: multiplierFor(streak) })}</span>
              <span>{t('sunGame.level', { level: levelFor(hits) })}</span>
            </div>
            {mode === 'timed' && <div role="progressbar" aria-label={t('sunGame.timeRemaining')} aria-valuemin={0} aria-valuemax={DURATION} aria-valuenow={remaining} aria-valuetext={t('sunGame.time', { seconds: remaining })} className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
              <div className={`h-full origin-left rounded-full transition-transform duration-300 motion-reduce:transition-none ${remaining <= 5 ? 'bg-red-500' : 'bg-primary'}`} style={{ transform: `scaleX(${remaining / DURATION})` }} />
            </div>}
            {mode === 'timed' && phase === 'playing' && remaining <= 5 && <p role="status" className="w-full text-center text-xs font-bold text-red-500">{t('sunGame.lastSeconds')}</p>}
          </div>
          {phase === 'playing' || phase === 'paused' ? (
            <>
            <button
              ref={ballRef}
              type="button"
              disabled={phase === 'paused'}
              onPointerDown={(event) => {
                // Score on contact: the moving ball may be elsewhere on release.
                if (event.button === 0) hit()
              }}
              onClick={(event) => {
                // Keyboard and assistive technology activate without a pointer.
                if (event.detail === 0) hit()
              }}
              aria-label={t('sunGame.catch')}
              className={`absolute left-0 top-0 cursor-pointer touch-none rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary ${feedback ? 'bg-primary/20 ring-4 ring-primary/40' : ''}`}
              style={{ width: gameSize, height: gameSize }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/sun/sol6.png" alt="" width={gameSize} height={gameSize} draggable={false} className="pointer-events-none" />
              {feedback > 0 && <span key={hits} aria-hidden="true" className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 text-xl font-black text-primary motion-safe:animate-bounce">+{feedback}</span>}
            </button>
            {phase === 'paused' && (
              <div className="absolute inset-x-0 bottom-0 top-[var(--sun-game-hud-height,200px)] z-20 overflow-y-auto bg-background/40 px-6 py-6">
                <div className="mx-auto w-full max-w-sm rounded-3xl border border-primary/20 bg-background p-6 text-center shadow-xl">
                  <h3 className="text-2xl font-bold">{t('sunGame.paused')}</h3>
                  <p className="my-5 text-sm text-foreground/70">{t('sunGame.pauseHint')}</p>
                  <button ref={resumeRef} type="button" onClick={resume} className="rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">{t('sunGame.resume')}</button>
                </div>
              </div>
            )}
            </>
          ) : (
            <div className="absolute inset-x-0 bottom-0 top-[var(--sun-game-hud-height,200px)] overflow-y-auto px-6 py-6">
              <div className="mx-auto w-full max-w-sm rounded-3xl border border-primary/20 bg-background p-6 text-center shadow-xl">
                <h3 className="text-2xl font-bold" tabIndex={-1} ref={(node) => node?.focus()}>{t(mode === 'practice' ? 'sunGame.practice.finished' : 'sunGame.finished')}</h3>
                {newRecord && <p role="status" className="mt-3 rounded-full bg-primary/15 px-3 py-1 text-sm font-bold text-primary">{t('sunGame.newRecord')}</p>}
                <p className="my-5 text-4xl font-black tabular-nums">{t('sunGame.points', { count: points })}</p>
                <p className="text-sm text-foreground/70">{t('footer.sunHits', { count: hits })}</p>
                <p className="mt-2 text-sm text-foreground/70">{t('sunGame.misses', { count: misses })}</p>
                <p className="mt-2 text-sm font-semibold">{t('sunGame.accuracy', { percent: accuracy })}</p>
                <p className="mt-2 mb-4 text-sm text-foreground/70">{t('sunGame.bestStreak', { count: bestStreak })}</p>
                {mode === 'timed' && <p className="mb-6 text-foreground/70">{t('sunGame.best', { count: best })}</p>}
                {newAchievements.length > 0 && <p role="status" className="mb-3 text-sm font-semibold text-primary">{t('sunGame.medals.earned', { count: newAchievements.length })}</p>}
                {mode === 'timed' && <p role="status" className="mb-3 text-sm font-semibold">{currentRank !== null ? t('sunGame.leaderboard.position', { rank: currentRank }) : t('sunGame.leaderboard.notRanked')}</p>}
                {mode === 'practice' && <p className="mb-5 text-sm text-foreground/70">{t('sunGame.practice.notice')}</p>}
                <button type="button" onClick={() => start(mode)} className="rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">{t(mode === 'practice' ? 'sunGame.practice.replay' : 'sunGame.replay')}</button>
                {mode === 'practice' && <button type="button" onClick={() => start('timed')} className="mt-3 rounded-full border border-foreground/20 px-6 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">{t('sunGame.practice.timed')}</button>}
                {mode === 'timed' && <>
                <SunGameLeaderboard entries={leaderboard} currentRank={currentRank} />
                <section aria-label={t('sunGame.medals.title')} className="mt-6 border-t border-foreground/10 pt-5 text-left">
                  <h4 className="text-base font-bold">{t('sunGame.medals.count', { count: achievements.length, total: ACHIEVEMENT_IDS.length })}</h4>
                  <p className="mt-1 text-xs text-foreground/70">{t('sunGame.medals.hint')}</p>
                  <ul className="mt-4 space-y-3">
                    {ACHIEVEMENT_IDS.map((id) => {
                      const unlocked = achievements.includes(id)
                      const isNew = newAchievements.includes(id)
                      return (
                        <li key={id} className={`rounded-xl border p-3 ${unlocked ? 'border-primary/30 bg-primary/10' : 'border-foreground/10'}`}>
                          <div className="flex items-center justify-between gap-2">
                            <h5 className="text-sm font-semibold"><span aria-hidden="true" className="mr-2">{unlocked ? '★' : '☆'}</span>{t(`sunGame.medals.${id}.title`)}</h5>
                            <span className={`shrink-0 text-xs font-semibold ${isNew ? 'text-primary' : 'text-foreground/70'}`}>{t(isNew ? 'sunGame.medals.new' : unlocked ? 'sunGame.medals.unlocked' : 'sunGame.medals.locked')}</span>
                          </div>
                          <p className="mt-1 text-xs text-foreground/70">{t(`sunGame.medals.${id}.description`)}</p>
                        </li>
                      )
                    })}
                  </ul>
                </section>
                </>}
              </div>
            </div>
          )}
        </dialog>, document.body,
      )}
    </div>
  )
}
