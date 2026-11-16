/// <reference types="jest" />

import { LEADERBOARD_KEY, rankScores, readLeaderboard, type ScoreEntry } from '@/lib/sun-game-leaderboard'

const entry = (id: string, points: number, hits = points, misses = 0, bestStreak = hits): ScoreEntry => ({ id, points, hits, misses, bestStreak })
afterEach(() => { localStorage.clear(); jest.restoreAllMocks() })

test('ranks points first, then accuracy, then streak, preserving exact ties', () => {
  const scores = [entry('less-accurate', 10, 10, 1), entry('short-streak', 10, 10, 0, 4), entry('long-streak', 10), entry('exact-tie', 10), entry('more-points', 11, 11, 3)]
  expect(rankScores(scores).map((score) => score.id)).toEqual(['more-points', 'long-streak', 'exact-tie', 'short-streak', 'less-accurate'])
  expect(scores[0].id).toBe('less-accurate')
})

test('keeps five entries, deduplicating identifiers but retaining separate equal rounds', () => {
  const scores = [entry('a', 10), entry('a', 10), entry('b', 10), entry('c', 9), entry('d', 8), entry('e', 7), entry('f', 6)]
  expect(rankScores(scores).map((score) => score.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
})

test('empty attempts have zero accuracy and saved entries are sorted', () => {
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify([entry('empty', 0), entry('second', 4), entry('first', 7)]))
  expect(readLeaderboard().map((score) => score.id)).toEqual(['first', 'second', 'empty'])
})

test('discards malformed and impossible results without discarding valid results', () => {
  const valid = entry('valid', 10)
  const invalid = [null, {}, { ...valid, id: '' }, { ...valid, hits: -1 }, { ...valid, misses: 0.5 }, { ...valid, points: '10' }, { ...valid, bestStreak: 11 }, { ...valid, points: 9 }, { ...valid, points: 31 }]
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify([...invalid, valid]))
  expect(readLeaderboard()).toEqual([valid])
})

test('invalid or inaccessible browser storage yields an empty leaderboard', () => {
  for (const saved of ['invalid json', 'null', '{}']) {
    localStorage.setItem(LEADERBOARD_KEY, saved)
    expect(readLeaderboard()).toEqual([])
  }
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Disabled') })
  expect(readLeaderboard()).toEqual([])
})
