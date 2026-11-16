export const ACHIEVEMENT_IDS = ['firstGame', 'combo', 'precision', 'expert'] as const
export type AchievementId = typeof ACHIEVEMENT_IDS[number]
export const ACHIEVEMENTS_KEY = 'cejoventut.sun-game.achievements.v1'

type Round = { hits: number; misses: number; bestStreak: number }

export function earnedAchievements(round: Round): AchievementId[] {
  return ACHIEVEMENT_IDS.filter((id) => {
    switch (id) {
      case 'firstGame': return true
      case 'combo': return round.bestStreak >= 10
      case 'precision': return round.hits >= 10 && round.hits * 10 >= (round.hits + round.misses) * 9
      case 'expert': return round.hits >= 20
    }
  })
}

export function readAchievements(): AchievementId[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(ACHIEVEMENTS_KEY) ?? '[]')
    return Array.isArray(saved) ? ACHIEVEMENT_IDS.filter((id) => saved.includes(id)) : []
  } catch {
    return []
  }
}
