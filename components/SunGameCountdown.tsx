'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n'

export default function SunGameCountdown({ onComplete }: { onComplete: () => void }) {
  const { t } = useTranslation()
  const [count, setCount] = useState(3)
  useEffect(() => {
    const deadline = Date.now() + 3000
    const timer = setInterval(() => {
      const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      if (next === 0) { clearInterval(timer); onComplete() }
      else setCount(next)
    }, 100)
    return () => clearInterval(timer)
  }, [onComplete])
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="flex items-center gap-3 rounded-xl border border-primary/20 bg-background px-3 py-2 shadow-xl">
      <p className="text-sm font-semibold">{t('sunGame.countdown.ready')}</p>
      <p aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-3xl leading-none font-black text-primary-foreground tabular-nums">{count}</p>
      <span className="sr-only">{t('sunGame.countdown.announcement', { count })}</span>
    </div>
  )
}
