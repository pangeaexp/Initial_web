export const LEADERBOARD_KEY = 'cejoventut.sun-game.leaderboard.v1'
export type ScoreEntry = { id: string; points: number; hits: number; misses: number; bestStreak: number }

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const accuracy = (entry: ScoreEntry) => entry.hits + entry.misses > 0 ? entry.hits / (entry.hits + entry.misses) : 0

function parseEntry(value: unknown): ScoreEntry | null {
  if (!value || typeof value !== 'object') return null
  const { id, points, hits, misses, bestStreak } = value as Record<string, unknown>
  if (typeof id !== 'string' || !id || id.length > 100 || !isCount(points) || !isCount(hits) || !isCount(misses) || !isCount(bestStreak)) return null
  if (bestStreak > hits || points < hits || points > hits * 3) return null
  return { id, points, hits, misses, bestStreak }
}

export function rankScores(entries: ScoreEntry[]): ScoreEntry[] {
  const unique = new Map<string, ScoreEntry>()
  for (const entry of entries) if (!unique.has(entry.id)) unique.set(entry.id, entry)
  return [...unique.values()].sort((a, b) => b.points - a.points || accuracy(b) - accuracy(a) || b.bestStreak - a.bestStreak).slice(0, 5)
}

export function readLeaderboard(): ScoreEntry[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(LEADERBOARD_KEY) ?? '[]')
    if (!Array.isArray(saved)) return []
    return rankScores(saved.map(parseEntry).filter((entry): entry is ScoreEntry => entry !== null))
  } catch {
    return []
  }
}
