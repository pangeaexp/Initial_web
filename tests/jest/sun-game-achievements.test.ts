/// <reference types="jest" />

import { ACHIEVEMENTS_KEY, earnedAchievements, readAchievements } from '@/lib/sun-game-achievements'

afterEach(() => { localStorage.clear(); jest.restoreAllMocks() })

test('a completed round without hits earns only the first match medal', () => {
  expect(earnedAchievements({ hits: 0, misses: 0, bestStreak: 0 })).toEqual(['firstGame'])
})

test('precision requires enough attempts and an actual accuracy of at least 90%', () => {
  expect(earnedAchievements({ hits: 9, misses: 0, bestStreak: 9 })).not.toContain('precision')
  expect(earnedAchievements({ hits: 10, misses: 1, bestStreak: 5 })).toContain('precision')
  expect(earnedAchievements({ hits: 18, misses: 2, bestStreak: 5 })).toContain('precision')
  expect(earnedAchievements({ hits: 10, misses: 2, bestStreak: 5 })).not.toContain('precision')
  // Rounded display values must not accidentally meet a numerical threshold.
  expect(earnedAchievements({ hits: 26, misses: 3, bestStreak: 5 })).not.toContain('precision')
})

test('combo and maximum level medals use their own thresholds', () => {
  expect(earnedAchievements({ hits: 19, misses: 10, bestStreak: 9 })).toEqual(['firstGame'])
  expect(earnedAchievements({ hits: 20, misses: 10, bestStreak: 10 })).toEqual(['firstGame', 'combo', 'expert'])
})

test('saved medals are deduplicated and unknown identifiers are discarded', () => {
  localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(['combo', 'combo', 'unknown', 42, 'expert']))
  expect(readAchievements()).toEqual(['combo', 'expert'])
})

test('invalid or unavailable storage falls back to an empty collection', () => {
  for (const value of ['invalid json', '{}', 'null', '42']) {
    localStorage.setItem(ACHIEVEMENTS_KEY, value)
    expect(readAchievements()).toEqual([])
  }
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Disabled') })
  expect(readAchievements()).toEqual([])
})
