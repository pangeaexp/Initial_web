'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '@/lib/i18n'
import { advanceGame, applyInput, BALL_SIZE, createGame, MAX_INPUTS, MIN_INPUT_GAP, ROUND_MS, RULES_VERSION, type Challenge, type Game, type GameInput, type HallEntry } from '@/lib/sun-hall/game'
import SunGameCountdown from '@/components/SunGameCountdown'
import { positionTableTennisBall, TableTennisBall, TableTennisBallShadow, TableTennisCourt, TableTennisPaddle } from '@/components/TableTennis'
import { paddlePosition, paddleTransform, projectTableBall } from '@/lib/table-tennis'
import { opponentPaddleTransform } from '@/lib/table-tennis-scene'

type Phase = 'lobby' | 'starting' | 'countdown' | 'playing' | 'finished' | 'published'
const errorCode = (code: unknown) => ['limited', 'expired', 'invalid'].includes(String(code)) ? String(code) : 'unavailable'

export default function SunHallOfFame({ className, onOpenChange }: { className?: string; onOpenChange?: (open: boolean) => void }) {
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
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishedId, setPublishedId] = useState('')
  const launchRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const ballRef = useRef<HTMLButtonElement>(null)
  const ballShadowRef = useRef<HTMLSpanElement>(null)
  const paddleRef = useRef<HTMLSpanElement>(null)
  const opponentRef = useRef<HTMLSpanElement>(null)
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
  const beginRound = useCallback(() => {
    if (phaseRef.current !== 'countdown') return
    if (document.hidden) { challengeRef.current = null; setError('interrupted'); changePhase('lobby'); return }
    startedRef.current = performance.now()
    changePhase('playing')
  }, [changePhase])
  const close = () => {
    epochRef.current++
    requestRef.current?.abort()
    challengeRef.current = null
    setOpen(false)
    onOpenChange?.(false)
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
    if (phase !== 'playing' && phase !== 'countdown') return
    if (phase === 'playing') {
      ballRef.current?.focus({ preventScroll: true })
      const game = gameRef.current
      if (game && paddleRef.current) paddleRef.current.style.transform = paddleTransform(game.width / 2, game.height - 70, game.width, game.height)
    }
    let animation = 0
    const step = () => {
      if (phaseRef.current !== 'playing' || !gameRef.current) return
      const elapsed = Math.max(0, Math.floor(performance.now() - startedRef.current))
      advanceGame(gameRef.current, elapsed)
      const game = gameRef.current
      if (ballRef.current) positionTableTennisBall(ballRef.current, ballShadowRef.current, game.ball, game.width, game.height, BALL_SIZE)
      if (opponentRef.current) opponentRef.current.style.transform = opponentPaddleTransform(game.ball.x, game.width, game.height)
      const seconds = Math.max(0, Math.ceil((ROUND_MS - elapsed) / 1000))
      setRemaining((previous) => previous === seconds ? previous : seconds)
      if (elapsed >= ROUND_MS) { setStats({ ...game }); changePhase('finished'); return }
      animation = requestAnimationFrame(step)
    }
    const interrupt = () => {
      if (phaseRef.current !== 'playing' && phaseRef.current !== 'countdown') return
      challengeRef.current = null
      setError('interrupted')
      changePhase('lobby')
    }
    const visibility = () => { if (document.hidden) interrupt() }
    window.addEventListener('resize', interrupt)
    document.addEventListener('visibilitychange', visibility)
    visibility()
    if (phase === 'playing') step()
    return () => {
      cancelAnimationFrame(animation)
      window.removeEventListener('resize', interrupt)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [phase, changePhase])

  useEffect(() => {
    if (phase === 'finished' || phase === 'published') {
      if (dialogRef.current) dialogRef.current.scrollTop = 0
      resultRef.current?.focus({ preventScroll: true })
    }
  }, [phase])

  const start = async () => {
    if (phaseRef.current === 'starting' || phaseRef.current === 'countdown' || phaseRef.current === 'playing') return
    const board = boardRef.current
    if (!board) return
    const width = Math.floor(board.clientWidth), height = Math.floor(board.clientHeight)
    if (width < 240 || height < 160) { setError('smallBoard'); return }
    const epoch = ++epochRef.current
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setError(''); setConsent(false); setPublishOpen(false); setPublishedId(''); setRemaining(30)
    changePhase('starting')
    try {
      const response = await fetch('/api/sun-hall/challenge', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ width, height }) })
      const data = await response.json()
      if (epoch !== epochRef.current) return
      if (!response.ok) { setError(errorCode(data.error)); changePhase('lobby'); return }
      if (data.rulesVersion !== RULES_VERSION) { setError('unavailable'); changePhase('lobby'); return }
      if (document.hidden || board.clientWidth !== width || board.clientHeight !== height) {
        challengeRef.current = null
        setError('interrupted'); changePhase('lobby'); return
      }
      const challenge = data as Challenge
      challengeRef.current = challenge
      gameRef.current = createGame(challenge, challenge.seed)
      inputsRef.current = []
      setStats({ ...gameRef.current })
      changePhase('countdown')
    } catch {
      if (epoch === epochRef.current) { setError('unavailable'); changePhase('lobby') }
    }
  }

  const contact = (x: number, y: number) => {
    if (phaseRef.current !== 'playing' || !gameRef.current) return
    const time = Math.max(0, Math.floor(performance.now() - startedRef.current))
    const previous = inputsRef.current.at(-1)
    if (time >= ROUND_MS || (previous && time - previous.t < MIN_INPUT_GAP) || inputsRef.current.length >= MAX_INPUTS) return
    const point = paddlePosition(x, y, gameRef.current.width, gameRef.current.height)
    const input = { t: time, x: point.x, y: point.y }
    applyInput(gameRef.current, input)
    if (paddleRef.current) paddleRef.current.style.transform = point.transform
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
        body: JSON.stringify({ rulesVersion: RULES_VERSION, token: challengeRef.current.token, alias: name, consent: true, inputs: inputsRef.current }) })
      const data = await response.json()
      if (epoch !== epochRef.current) return
      if (!response.ok) { setError(errorCode(data.error)); return }
      listEpochRef.current++
      setPublishedId(data.id); setEntries(data.entries); setLoadState('ready'); changePhase('published')
    } catch { if (epoch === epochRef.current) setError('unavailable') }
    finally { if (epoch === epochRef.current) setPublishing(false) }
  }

  const showResult = phase === 'finished' || phase === 'published'
  const showBoard = phase === 'playing' || phase === 'countdown'
  const accuracy = stats && stats.hits + stats.misses > 0 ? Math.round(stats.hits / (stats.hits + stats.misses) * 100) : 0
  const bestStreak = stats?.bestStreak ?? 0
  const replayButton = (
    <button type="button" disabled={publishing} onClick={() => { challengeRef.current = null; setError(''); changePhase('lobby') }} className="min-h-11 rounded-xl border border-foreground/20 px-2 py-1 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-primary sm:px-3 sm:text-sm">{t('sunGame.replay')}</button>
  )
  const movePaddle = (clientX: number, clientY: number) => {
    if (phaseRef.current !== 'playing' || !boardRef.current || !paddleRef.current) return
    const board = boardRef.current, rect = board.getBoundingClientRect()
    paddleRef.current.style.transform = paddleTransform(clientX - rect.left - board.clientLeft, clientY - rect.top - board.clientTop, board.clientWidth, board.clientHeight)
  }
  return <>
    <button ref={launchRef} type="button" onClick={() => { setError(''); setOpen(true); onOpenChange?.(true) }} className={className ?? 'rounded-full border border-primary/30 bg-background/95 px-3 py-2 text-sm font-semibold text-foreground shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary'}>{t('sunHall.title')}</button>
    {open && createPortal(
      <dialog ref={dialogRef} aria-labelledby="sun-hall-title" onCancel={(event) => { event.preventDefault(); event.stopPropagation(); close() }} className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-y-auto border-0 bg-background/20 p-0 text-foreground backdrop:bg-black/10 max-sm:[scrollbar-width:none] sm:[scrollbar-gutter:stable]">
        <header className="sticky top-0 z-30 border-b border-foreground/10 bg-background/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-3 py-1.5 sm:px-4 sm:py-2">
            {showResult ? (
              <h2 id="sun-hall-title" ref={resultRef} tabIndex={-1} className="text-base font-bold outline-none">{t('sunGame.finished')}</h2>
            ) : (
              <div>
                <h2 id="sun-hall-title" className="text-base font-bold">{t('sunHall.title')}</h2>
                <p className="text-xs text-foreground/70">{t('sunHall.rules')}</p>
              </div>
            )}
            <button type="button" onClick={close} className="min-h-11 shrink-0 rounded-full border border-foreground/20 px-3 text-sm focus-visible:outline-2 focus-visible:outline-primary">{t('sunGame.exit')}</button>
          </div>
        </header>
        <main className={`mx-auto w-full space-y-2 px-3 sm:px-4 sm:py-3 ${showResult ? 'max-w-xl py-1' : 'max-w-3xl py-2'}`}>
          {error && <p role="alert" className="rounded-xl bg-background p-3 text-sm font-semibold">{t(`sunHall.errors.${error}`)}</p>}
          {showBoard && <div className="flex flex-wrap justify-between gap-x-2 gap-y-1 rounded-xl bg-background px-3 py-2 text-xs font-bold tabular-nums">
            <span role="status">{t('sunGame.points', { count: stats?.points ?? 0 })}</span>
            <span>{t('sunGame.combo', { count: stats?.streak ?? 0, multiplier: Math.min(3, 1 + Math.floor((stats?.streak ?? 0) / 5)) })}</span>
            <span className={remaining <= 5 ? 'text-red-500' : ''}>{t('sunGame.time', { seconds: remaining })}</span>
          </div>}
          {!showResult && <div className={`relative ${showBoard ? '' : 'overflow-hidden rounded-2xl'}`}>
            {!showBoard && <section className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-primary/20 bg-background px-2.5 py-1.5 sm:px-3 sm:py-2.5">
              <p className="min-w-24 flex-1 text-xs text-foreground/80 sm:text-sm">{t('sunHall.intro')}</p>
              <button type="button" disabled={phase === 'starting'} onClick={() => void start()} className="min-h-11 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50">{t(phase === 'starting' ? 'sunHall.preparing' : 'sunHall.play')}</button>
            </section>}
            {/* Keep the board measurable before requesting a challenge. */}
            <div ref={boardRef} role="region" aria-label={t('sunGame.table.label')} aria-hidden={!showBoard || undefined} onPointerMove={(event) => movePaddle(event.clientX, event.clientY)} onPointerDown={(event) => {
              if (event.button !== 0 || !boardRef.current) return
              const board = boardRef.current, rect = board.getBoundingClientRect()
              movePaddle(event.clientX, event.clientY)
              contact(event.clientX - rect.left - board.clientLeft, event.clientY - rect.top - board.clientTop)
            }} className={`mx-auto h-[min(50dvh,400px)] min-h-[180px] w-full max-w-[720px] overflow-hidden rounded-2xl border border-white/70 bg-[#0c544d]/85 shadow-xl ${showBoard ? 'relative' : 'invisible absolute inset-x-0 top-0'} ${phase === 'playing' ? 'cursor-none touch-none' : ''}`}>
              {showBoard && <TableTennisCourt />}
              {phase === 'countdown' && <div className="flex h-full items-center justify-center p-4"><SunGameCountdown onComplete={beginRound} /></div>}
              {phase === 'playing' && <>
                <TableTennisBallShadow ref={ballShadowRef} />
                <span ref={opponentRef} aria-hidden="true" className="pointer-events-none absolute left-0 top-0"><TableTennisPaddle opponent /></span>
                <span ref={paddleRef} aria-hidden="true" className="pointer-events-none absolute left-0 top-0"><TableTennisPaddle /></span>
                <button ref={ballRef} type="button" aria-label={t('sunGame.catch')} onClick={(event) => {
                  if (event.detail !== 0 || !gameRef.current) return
                  const game = gameRef.current
                  advanceGame(game, Math.max(0, Math.floor(performance.now() - startedRef.current)))
                  const ball = projectTableBall(game.ball, game.width, game.height)
                  contact(ball.x, ball.y)
                }} className="absolute left-0 top-0 cursor-none touch-none rounded-full focus-visible:outline-2 focus-visible:outline-white" style={{ width: BALL_SIZE, height: BALL_SIZE }}>
                  <TableTennisBall />
                </button>
              </>}
            </div>
          </div>}
          {showResult && <section className="rounded-2xl border border-primary/20 bg-background px-2.5 py-1.5 sm:px-3 sm:py-2.5">
            <div className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
              <p className="text-sm font-black sm:text-2xl">{t('sunGame.points', { count: stats?.points ?? 0 })}</p>
              <p className="text-xs text-foreground/70">
                <span className="sr-only sm:not-sr-only">{t('sunGame.accuracy', { percent: accuracy })} · {t('sunGame.bestStreak', { count: bestStreak })}</span>
                <span aria-hidden="true" className="sm:hidden">{t('sunHall.columns.accuracyShort')} {accuracy}% · {t('sunHall.columns.streak')}: {bestStreak}</span>
              </p>
            </div>
            <div className="mt-1 grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
              {phase === 'published' ? (
                <p role="status" className="text-xs font-semibold">{t('sunHall.published')}</p>
              ) : (
                <button type="button" disabled={publishing} aria-expanded={publishOpen} aria-controls={publishOpen ? 'sun-hall-publish' : undefined} onClick={() => { if (publishOpen) setError(''); setPublishOpen(!publishOpen) }} className="min-h-11 rounded-xl bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 sm:px-3 sm:text-sm">
                  {t(publishOpen ? 'sunHall.cancelPublish' : 'sunHall.publish')}
                </button>
              )}
              {replayButton}
            </div>
            {phase === 'finished' && publishOpen && (
              <form id="sun-hall-publish" onSubmit={(event) => void publish(event)} className="mt-2 grid gap-2 border-t border-foreground/10 pt-2">
                <p className="text-xs text-foreground/80">{t('sunHall.optional')}</p>
                <label className="grid gap-1 text-sm font-semibold" htmlFor="sun-hall-alias">
                  {t('sunHall.alias')}
                  <input id="sun-hall-alias" value={alias} onChange={(event) => setAlias(event.target.value)} minLength={3} maxLength={20} required autoComplete="off" disabled={publishing} className="min-h-11 w-full rounded-lg border border-foreground/20 bg-background px-3 text-base font-normal focus-visible:outline-2 focus-visible:outline-primary" />
                </label>
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"><input type="checkbox" required checked={consent} onChange={(event) => setConsent(event.target.checked)} disabled={publishing} className="size-4 shrink-0 accent-primary" />{t('sunHall.consent')}</label>
                <button type="submit" disabled={publishing || !consent} className="min-h-11 justify-self-start rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50">{t(publishing ? 'sunHall.publishing' : 'sunHall.publish')}</button>
              </form>
            )}
          </section>}
          {!showBoard && <section aria-label={t('sunHall.top')} className="rounded-2xl border border-foreground/10 bg-background px-2.5 py-1.5 sm:px-3 sm:py-2.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold">{t('sunHall.top')}</h3>
              <button type="button" onClick={() => setRefresh((value) => value + 1)} disabled={loadState === 'loading'} className="min-h-11 rounded-lg border border-foreground/20 px-2.5 text-xs focus-visible:outline-2 focus-visible:outline-primary">{t('sunHall.refresh')}</button>
            </div>
            {loadState === 'loading' ? <p role="status" className="mt-1 text-sm">{t('sunHall.loading')}</p> : loadState === 'error' ? <p role="alert" className="mt-1 text-sm">{t('sunHall.errors.unavailable')}</p> : entries.length === 0 ? <p className="mt-1 text-sm text-foreground/70">{t('sunHall.empty')}</p> : (
              <table aria-label={t('sunHall.top')} className="w-full table-fixed text-xs leading-tight tabular-nums sm:text-sm">
                <thead className="border-b border-foreground/15 text-foreground/70">
                  <tr>
                    <th scope="col" aria-label={t('sunHall.columns.rank')} className="w-5 py-1 text-left sm:w-10">#</th>
                    <th scope="col" className="py-1 text-left">{t('sunHall.columns.alias')}</th>
                    <th scope="col" aria-label={t('sunHall.columns.points')} className="w-8 py-1 text-right sm:w-20">
                      <span className="sm:hidden">{t('sunHall.columns.pointsShort')}</span>
                      <span className="hidden sm:inline">{t('sunHall.columns.points')}</span>
                    </th>
                    <th scope="col" aria-label={t('sunHall.columns.accuracy')} className="w-10 py-1 text-right sm:w-24">
                      <span className="sm:hidden">{t('sunHall.columns.accuracyShort')}</span>
                      <span className="hidden sm:inline">{t('sunHall.columns.accuracy')}</span>
                    </th>
                    <th scope="col" className="w-10 py-1 text-right sm:w-20">{t('sunHall.columns.streak')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-foreground/10">
                  {entries.map((entry, index) => (
                    <tr key={entry.id} aria-current={publishedId === entry.id ? 'true' : undefined} className={`*:py-px max-sm:[@media(min-height:640px)]:*:py-1 sm:*:py-1.5 ${publishedId === entry.id ? 'bg-primary/10' : ''}`}>
                      <td className="font-bold">{index + 1}</td>
                      <th scope="row" className="text-left font-semibold wrap-anywhere">{entry.alias}</th>
                      <td className="text-right font-bold">{entry.points}</td>
                      <td className="text-right text-foreground/80">{Math.round(entry.accuracy)}%</td>
                      <td className="text-right text-foreground/80">{entry.best_streak}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>}
        </main>
      </dialog>, document.body,
    )}
  </>
}
