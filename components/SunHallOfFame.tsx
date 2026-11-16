'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '@/lib/i18n'
import { advanceGame, applyInput, BALL_SIZE, createGame, MAX_INPUTS, MIN_INPUT_GAP, ROUND_MS, type Challenge, type Game, type GameInput, type HallEntry } from '@/lib/sun-hall/game'

type Phase = 'lobby' | 'starting' | 'playing' | 'finished' | 'published'
const errorCode = (code: unknown) => ['limited', 'expired', 'invalid'].includes(String(code)) ? String(code) : 'unavailable'

export default function SunHallOfFame() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('lobby')
  const [entries, setEntries] = useState<HallEntry[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [refresh, setRefresh] = useState(0)
  const [stats, setStats] = useState<Game | null>(null)
  const [remaining, setRemaining] = useState(30)
  const [error, setError] = useState('')
  const [alias, setAlias] = useState('')
  const [consent, setConsent] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishedId, setPublishedId] = useState('')
  const launchRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const ballRef = useRef<HTMLButtonElement>(null)
  const resultRef = useRef<HTMLHeadingElement>(null)
  const phaseRef = useRef<Phase>('lobby')
  const challengeRef = useRef<Challenge | null>(null)
  const gameRef = useRef<Game | null>(null)
  const inputsRef = useRef<GameInput[]>([])
  const startedRef = useRef(0)
  const epochRef = useRef(0)
  const listEpochRef = useRef(0)
  const requestRef = useRef<AbortController | null>(null)
  const changePhase = useCallback((next: Phase) => { phaseRef.current = next; setPhase(next) }, [])
  const close = () => {
    epochRef.current++
    requestRef.current?.abort()
    challengeRef.current = null
    setOpen(false)
    changePhase('lobby')
    setPublishing(false)
  }

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    const launch = launchRef.current
    dialog?.showModal()
    return () => { dialog?.close(); launch?.focus({ preventScroll: true }) }
  }, [open])

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    const epoch = ++listEpochRef.current
    setLoadState('loading')
    void fetch('/api/sun-hall', { signal: controller.signal, cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error('Unavailable')
      const data = await response.json()
      if (!controller.signal.aborted && epoch === listEpochRef.current) { setEntries(data.entries); setLoadState('ready') }
    }).catch(() => { if (!controller.signal.aborted && epoch === listEpochRef.current) setLoadState('error') })
    return () => controller.abort()
  }, [open, refresh])

  useEffect(() => () => { requestRef.current?.abort() }, [])

  useEffect(() => {
    if (phase !== 'playing') return
    ballRef.current?.focus({ preventScroll: true })
    let animation = 0
    const step = () => {
      if (phaseRef.current !== 'playing' || !gameRef.current) return
      const elapsed = Math.max(0, Math.floor(performance.now() - startedRef.current))
      advanceGame(gameRef.current, elapsed)
      const game = gameRef.current
      if (ballRef.current) ballRef.current.style.transform = `translate3d(${game.x}px, ${game.y}px, 0)`
      const seconds = Math.max(0, Math.ceil((ROUND_MS - elapsed) / 1000))
      setRemaining((previous) => previous === seconds ? previous : seconds)
      if (elapsed >= ROUND_MS) { setStats({ ...game }); changePhase('finished'); return }
      animation = requestAnimationFrame(step)
    }
    const interrupt = () => {
      if (phaseRef.current !== 'playing') return
      challengeRef.current = null
      setError('interrupted')
      changePhase('lobby')
    }
    const visibility = () => { if (document.hidden) interrupt() }
    window.addEventListener('resize', interrupt)
    document.addEventListener('visibilitychange', visibility)
    visibility()
    step()
    return () => {
      cancelAnimationFrame(animation)
      window.removeEventListener('resize', interrupt)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [phase, changePhase])

  useEffect(() => { if (phase === 'finished') resultRef.current?.focus({ preventScroll: true }) }, [phase])

  const start = async () => {
    if (phaseRef.current === 'starting' || phaseRef.current === 'playing') return
    const board = boardRef.current
    if (!board) return
    const width = Math.floor(board.clientWidth), height = Math.floor(board.clientHeight)
    if (width < 240 || height < 160) { setError('smallBoard'); return }
    const epoch = ++epochRef.current
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setError(''); setConsent(false); setPublishedId(''); setRemaining(30)
    changePhase('starting')
    try {
      const response = await fetch('/api/sun-hall/challenge', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ width, height }) })
      const data = await response.json()
      if (epoch !== epochRef.current) return
      if (!response.ok) { setError(errorCode(data.error)); changePhase('lobby'); return }
      if (document.hidden || board.clientWidth !== width || board.clientHeight !== height) {
        challengeRef.current = null
        setError('interrupted'); changePhase('lobby'); return
      }
      const challenge = data as Challenge
      challengeRef.current = challenge
      gameRef.current = createGame(challenge, challenge.seed)
      inputsRef.current = []
      startedRef.current = performance.now()
      setStats({ ...gameRef.current })
      changePhase('playing')
    } catch {
      if (epoch === epochRef.current) { setError('unavailable'); changePhase('lobby') }
    }
  }

  const contact = (x: number, y: number) => {
    if (phaseRef.current !== 'playing' || !gameRef.current) return
    const time = Math.max(0, Math.floor(performance.now() - startedRef.current))
    const previous = inputsRef.current.at(-1)
    if (time >= ROUND_MS || (previous && time - previous.t < MIN_INPUT_GAP) || inputsRef.current.length >= MAX_INPUTS) return
    const input = { t: time, x: Math.max(0, Math.min(x, gameRef.current.width)), y: Math.max(0, Math.min(y, gameRef.current.height)) }
    applyInput(gameRef.current, input)
    inputsRef.current.push(input)
    setStats({ ...gameRef.current })
  }

  const publish = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!challengeRef.current || phaseRef.current !== 'finished' || publishing || !consent) return
    const name = alias.trim().normalize('NFC')
    if (name.length < 3 || name.length > 20 || !/^[\p{L}\p{N} _-]+$/u.test(name)) { setError('alias'); return }
    setPublishing(true); setError('')
    const epoch = epochRef.current
    const controller = new AbortController()
    requestRef.current = controller
    try {
      const response = await fetch('/api/sun-hall/publish', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: challengeRef.current.token, alias: name, consent: true, inputs: inputsRef.current }) })
      const data = await response.json()
      if (epoch !== epochRef.current) return
      if (!response.ok) { setError(errorCode(data.error)); return }
      listEpochRef.current++
      setPublishedId(data.id); setEntries(data.entries); setLoadState('ready'); changePhase('published')
    } catch { if (epoch === epochRef.current) setError('unavailable') }
    finally { if (epoch === epochRef.current) setPublishing(false) }
  }

  const showResult = phase === 'finished' || phase === 'published'
  return <>
    <button ref={launchRef} type="button" onClick={() => { setError(''); setOpen(true) }} className="rounded-full border border-primary/30 bg-background/95 px-3 py-2 text-sm font-semibold text-foreground shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">{t('sunHall.title')}</button>
    {open && createPortal(
      <dialog ref={dialogRef} aria-labelledby="sun-hall-title" onCancel={(event) => { event.preventDefault(); close() }} className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-y-auto border-0 bg-background/20 p-0 text-foreground backdrop:bg-black/10">
        <header className="sticky top-0 z-30 flex items-start justify-between gap-3 border-b border-foreground/10 bg-background/95 p-4 backdrop-blur-sm">
          <div><h2 id="sun-hall-title" className="text-lg font-bold">{t('sunHall.title')}</h2><p className="mt-1 text-xs text-foreground/70">{t('sunHall.rules')}</p></div>
          <button type="button" onClick={close} className="shrink-0 rounded-full border border-foreground/20 px-4 py-2 text-sm">{t('sunGame.exit')}</button>
        </header>
        <main className="mx-auto w-full max-w-3xl space-y-5 p-4">
          {error && <p role="alert" className="rounded-xl bg-background/95 p-3 text-sm font-semibold">{t(`sunHall.errors.${error}`)}</p>}
          {phase === 'playing' && <div className="flex justify-between rounded-xl bg-background/95 p-3 text-sm font-bold tabular-nums"><span role="status">{t('sunGame.points', { count: stats?.points ?? 0 })}</span><span>{t('sunGame.combo', { count: stats?.streak ?? 0, multiplier: Math.min(3, 1 + Math.floor((stats?.streak ?? 0) / 5)) })}</span><span className={remaining <= 5 ? 'text-red-500' : ''}>{t('sunGame.time', { seconds: remaining })}</span></div>}
          <div ref={boardRef} hidden={showResult} onPointerDown={(event) => {
            if (event.button !== 0 || !boardRef.current) return
            const board = boardRef.current, rect = board.getBoundingClientRect()
            contact(event.clientX - rect.left - board.clientLeft, event.clientY - rect.top - board.clientTop)
          }} className="relative mx-auto h-[min(50dvh,400px)] min-h-[180px] w-full max-w-[720px] overflow-hidden rounded-2xl border border-primary/30 bg-background/40">
            {phase === 'playing' ? <button ref={ballRef} type="button" aria-label={t('sunGame.catch')} onClick={(event) => {
              if (event.detail !== 0 || !gameRef.current) return
              advanceGame(gameRef.current, Math.max(0, Math.floor(performance.now() - startedRef.current)))
              contact(gameRef.current.x + BALL_SIZE / 2, gameRef.current.y + BALL_SIZE / 2)
            }} className="absolute left-0 top-0 cursor-pointer touch-none rounded-full focus-visible:outline-2 focus-visible:outline-primary" style={{ width: BALL_SIZE, height: BALL_SIZE }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/sun/sol6.png" alt="" width={BALL_SIZE} height={BALL_SIZE} draggable={false} className="pointer-events-none" />
            </button> : <div className="flex h-full flex-col items-center justify-center gap-4 p-5 text-center"><p className="max-w-sm rounded-xl bg-background/90 p-3 text-sm">{t('sunHall.intro')}</p><button type="button" disabled={phase === 'starting'} onClick={() => void start()} className="rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground disabled:opacity-50">{t(phase === 'starting' ? 'sunHall.preparing' : 'sunHall.play')}</button></div>}
          </div>
          {showResult && <section className="rounded-2xl border border-primary/20 bg-background/95 p-5">
            <h3 ref={resultRef} tabIndex={-1} className="text-xl font-bold">{t('sunGame.finished')}</h3>
            <p className="mt-3 text-3xl font-black">{t('sunGame.points', { count: stats?.points ?? 0 })}</p>
            <p className="my-3 text-sm text-foreground/70">{t('sunGame.accuracy', { percent: stats && stats.hits + stats.misses > 0 ? Math.round(stats.hits / (stats.hits + stats.misses) * 100) : 0 })} · {t('sunGame.bestStreak', { count: stats?.bestStreak ?? 0 })}</p>
            {phase === 'published' ? <p role="status" className="font-semibold text-primary">{t('sunHall.published')}</p> : <form onSubmit={(event) => void publish(event)} className="space-y-3">
              <p className="text-sm">{t('sunHall.optional')}</p>
              <label className="block text-sm font-semibold" htmlFor="sun-hall-alias">{t('sunHall.alias')}</label>
              <input id="sun-hall-alias" value={alias} onChange={(event) => setAlias(event.target.value)} minLength={3} maxLength={20} required autoComplete="off" disabled={publishing} className="w-full rounded-xl border border-foreground/20 bg-background px-3 py-2" />
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" required checked={consent} onChange={(event) => setConsent(event.target.checked)} disabled={publishing} className="mt-1" />{t('sunHall.consent')}</label>
              <button type="submit" disabled={publishing || !consent} className="rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50">{t(publishing ? 'sunHall.publishing' : 'sunHall.publish')}</button>
            </form>}
            <button type="button" disabled={publishing} onClick={() => { challengeRef.current = null; setError(''); changePhase('lobby') }} className="mt-4 rounded-full border border-foreground/20 px-5 py-2 text-sm font-semibold">{t('sunGame.replay')}</button>
          </section>}
          {phase !== 'playing' && phase !== 'starting' && <section aria-label={t('sunHall.top')} className="rounded-2xl border border-foreground/10 bg-background/95 p-5">
            <div className="flex items-center justify-between gap-3"><h3 className="font-bold">{t('sunHall.top')}</h3><button type="button" onClick={() => setRefresh((value) => value + 1)} disabled={loadState === 'loading'} className="rounded-full border border-foreground/20 px-3 py-2 text-xs">{t('sunHall.refresh')}</button></div>
            {loadState === 'loading' ? <p role="status" className="mt-4 text-sm">{t('sunHall.loading')}</p> : loadState === 'error' ? <p role="alert" className="mt-4 text-sm">{t('sunHall.errors.unavailable')}</p> : entries.length === 0 ? <p className="mt-4 text-sm text-foreground/70">{t('sunHall.empty')}</p> : <ol className="mt-4 space-y-2">{entries.map((entry, index) => <li key={entry.id} aria-current={publishedId === entry.id ? 'true' : undefined} className={`flex items-center gap-3 rounded-xl border p-3 ${publishedId === entry.id ? 'border-primary/40 bg-primary/10' : 'border-foreground/10'}`}><span className="text-lg font-black">{index + 1}</span><div className="min-w-0 flex-1"><p className="break-words text-sm font-bold">{entry.alias}</p><p className="mt-1 text-xs text-foreground/70">{t('sunGame.accuracy', { percent: Math.round(entry.accuracy) })} · {t('sunGame.bestStreak', { count: entry.best_streak })}</p></div><span className="text-sm font-black tabular-nums">{entry.points}</span></li>)}</ol>}
          </section>}
        </main>
      </dialog>, document.body,
    )}
  </>
}
