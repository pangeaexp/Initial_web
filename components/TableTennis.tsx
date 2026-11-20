import { useEffect, useId, useRef } from 'react'
import { drawTableTennisScene } from '@/lib/table-tennis-scene'
import { BALL_RADIUS, projectTableBall, projectTablePoint, TABLE_HALF_LENGTH, TABLE_HEIGHT, type TableBall } from '@/lib/table-tennis'

export function TableTennisPaddle({ opponent = false, className = 'h-[62px] w-12' }: { opponent?: boolean; className?: string }) {
  const rubber = useId()
  const wood = useId()
  return (
    <svg aria-hidden="true" viewBox="0 0 64 82" className={className}>
      <defs>
        <radialGradient id={rubber} cx="32%" cy="28%" r="72%">
          <stop stopColor={opponent ? '#5188a4' : '#e94857'} />
          <stop offset="1" stopColor={opponent ? '#1b3549' : '#830e29'} />
        </radialGradient>
        <linearGradient id={wood}>
          <stop stopColor="#f2cb93" />
          <stop offset="1" stopColor="#9d6d42" />
        </linearGradient>
      </defs>
      <rect x="27" y="50" width="10" height="29" rx="4" fill={`url(#${wood})`} stroke="#38291d" strokeWidth="2" />
      <ellipse cx="32" cy="30" rx="27" ry="28" fill={`url(#${rubber})`} stroke="#eadbc1" strokeWidth="3" />
      <path d="M15 20c3-8 10-12 18-12" fill="none" stroke="white" strokeOpacity=".35" strokeWidth="3" strokeLinecap="round" />
      <text x="32" y="36" textAnchor="middle" fill="white" fontSize="14" fontWeight="800">TT</text>
    </svg>
  )
}

export function TableTennisBall() {
  return <span aria-hidden="true" data-table-tennis-ball className="pointer-events-none absolute left-1/2 top-1/2 size-[var(--table-tennis-ball-size,24px)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/90" style={{ background: 'radial-gradient(circle at 32% 25%, #fff 0%, #fafafa 48%, #a9b7b4 100%)' }} />
}

export function positionTableTennisBall(button: HTMLButtonElement, shadow: HTMLSpanElement | null, ball: TableBall, width: number, height: number, buttonSize: number) {
  const centre = projectTableBall(ball, width, height)
  button.style.transform = `translate3d(${centre.x - buttonSize / 2}px, ${centre.y - buttonSize / 2}px, 0)`
  button.style.setProperty('--table-tennis-ball-size', `${centre.radius * 2}px`)
  if (shadow) {
    const surfaceHeight = Math.abs(ball.z) <= TABLE_HALF_LENGTH ? TABLE_HEIGHT : 0
    const surface = projectTablePoint([ball.x, surfaceHeight, ball.z], width, height)
    const size = Math.max(5, BALL_RADIUS * surface.scale)
    shadow.style.transform = `translate3d(${surface.x}px, ${surface.y}px, 0) scale(${size / 12})`
    shadow.style.opacity = String(Math.max(0.26, 0.74 - (TABLE_HEIGHT + ball.y - surfaceHeight) * 0.33))
  }
  return centre
}

export function TableTennisBallShadow({ ref }: { ref: React.Ref<HTMLSpanElement> }) {
  return <span ref={ref} aria-hidden="true" className="pointer-events-none absolute top-0 left-0 size-0 opacity-0 before:absolute before:-left-3 before:-top-1.5 before:h-3 before:w-6 before:rounded-full before:bg-black/70 before:blur-[2px]" />
}

export function TableTennisCourt() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const draw = () => {
      const { width, height } = canvas.getBoundingClientRect()
      if (width === 0 || height === 0) return
      const context = canvas.getContext('2d')
      if (!context) return
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      drawTableTennisScene(context, width, height)
    }
    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
}
