'use client'

import { useTranslation } from '@/lib/i18n'
import type { ScoreEntry } from '@/lib/sun-game-leaderboard'

export default function SunGameLeaderboard({ entries, currentRank }: { entries: ScoreEntry[]; currentRank: number | null }) {
  const { t } = useTranslation()
  return (
    <section aria-label={t('sunGame.leaderboard.title')} className="mt-2 border-t border-foreground/10 pt-2 text-left">
      <h4 className="text-sm font-bold">{t('sunGame.leaderboard.title')}</h4>
      <p className="mt-1 text-xs text-foreground/70">{t('sunGame.leaderboard.hint')}</p>
      <ol className="mt-2 space-y-1">
        {entries.map((entry, index) => {
          const isCurrent = currentRank === index + 1
          const accuracy = entry.hits + entry.misses > 0 ? Math.round(entry.hits / (entry.hits + entry.misses) * 100) : 0
          return (
            <li key={entry.id} aria-current={isCurrent ? 'true' : undefined} className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${isCurrent ? 'border-primary/40 bg-primary/10' : 'border-foreground/10'}`}>
              <span className="min-w-3 text-sm font-black tabular-nums">{index + 1}</span>
              <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
                <p className="text-sm font-bold tabular-nums">{t('sunGame.points', { count: entry.points })}</p>
                <p className="text-xs text-foreground/70">{t('sunGame.accuracy', { percent: accuracy })} · {t('sunGame.bestStreak', { count: entry.bestStreak })}</p>
                {isCurrent && <p className="text-xs font-semibold text-primary">{t('sunGame.leaderboard.current')}</p>}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
