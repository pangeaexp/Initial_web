'use client'

import { useTranslation } from '@/lib/i18n'
import { ACHIEVEMENT_IDS, type AchievementId } from '@/lib/sun-game-achievements'

export default function SunGameMedals({ achievements, newAchievements = [] }: { achievements: AchievementId[]; newAchievements?: AchievementId[] }) {
  const { t } = useTranslation()
  return (
    <section aria-label={t('sunGame.medals.title')} className="mt-3 border-t border-foreground/10 pt-2 text-left">
      <h4 className="text-sm font-bold">{t('sunGame.medals.count', { count: achievements.length, total: ACHIEVEMENT_IDS.length })}</h4>
      <p className="mt-1 text-xs text-foreground/70">{t('sunGame.medals.hint')}</p>
      <ul className="mt-2 space-y-1">
        {ACHIEVEMENT_IDS.map((id) => {
          const unlocked = achievements.includes(id)
          const isNew = newAchievements.includes(id)
          return (
            <li key={id} className={`rounded-lg border px-2 py-1.5 ${unlocked ? 'border-primary/30 bg-primary/10' : 'border-foreground/10'}`}>
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
  )
}
