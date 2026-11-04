import { describe, expect, it } from 'vitest'
import { resolveWhatsNewSeen } from './settings'

describe('"What\'s new" seen id', () => {
  it('keeps a saved id', () => {
    expect(resolveWhatsNewSeen(2, false, 5)).toBe(2)
    expect(resolveWhatsNewSeen(0, true, 5)).toBe(0)
  })

  it('gives the latest id to a new install, and 0 to a user of an older version', () => {
    expect(resolveWhatsNewSeen(undefined, true, 5)).toBe(5)
    expect(resolveWhatsNewSeen(undefined, false, 5)).toBe(0)
  })

  it('ignores a bad saved value', () => {
    expect(resolveWhatsNewSeen('3', false, 5)).toBe(0)
    expect(resolveWhatsNewSeen(-1, true, 5)).toBe(5)
    expect(resolveWhatsNewSeen(1.5, false, 5)).toBe(0)
  })
})
