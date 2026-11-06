import { describe, expect, it } from 'vitest'
import type { Gradient } from './document'
import { addStop, cssPreview, defaultGradient, normalAngle, removeStop, stopAt, updateStop } from './gradient'

const redToBlue: Gradient = {
  type: 'linear',
  angle: 0,
  stops: [
    { offset: 1, color: '#0000ff', alpha: 0 },
    { offset: 0, color: '#ff0000', alpha: 1 }
  ]
}

describe('gradient edits', () => {
  it('starts as a fade of the layer colour', () => {
    expect(defaultGradient('radial', '#d7262e')).toEqual({
      type: 'radial',
      angle: 0,
      stops: [
        { offset: 0, color: '#d7262e', alpha: 1 },
        { offset: 1, color: '#d7262e', alpha: 0 }
      ]
    })
  })

  it('gives the colour between two stops, and the end colours outside them', () => {
    expect(stopAt(redToBlue, 0.5)).toEqual({ offset: 0.5, color: '#800080', alpha: 0.5 })
    const inner: Gradient = { ...redToBlue, stops: redToBlue.stops.map((s) => ({ ...s, offset: s.offset === 0 ? 0.2 : 0.8 })) }
    expect(stopAt(inner, 0.1)).toEqual({ offset: 0.1, color: '#ff0000', alpha: 1 })
    expect(stopAt(inner, 0.9)).toEqual({ offset: 0.9, color: '#0000ff', alpha: 0 })
  })

  it('adds a stop at the end of the list, up to 8 stops', () => {
    const added = addStop(redToBlue, 0.25)
    expect(added?.index).toBe(2)
    expect(added?.gradient.stops[2]).toEqual({ offset: 0.25, color: '#bf0040', alpha: 0.75 })
    let g = redToBlue
    for (let i = 0; i < 6; i++) g = addStop(g, 0.5)!.gradient
    expect(g.stops).toHaveLength(8)
    expect(addStop(g, 0.5)).toBeNull()
  })

  it('removes a stop, but keeps 2', () => {
    const three = addStop(redToBlue, 0.5)!.gradient
    expect(removeStop(three, 0).stops.map((s) => s.offset)).toEqual([0, 0.5])
    expect(removeStop(redToBlue, 0)).toBe(redToBlue)
  })

  it('changes one stop, and makes the CSS preview in offset order', () => {
    expect(updateStop(redToBlue, 1, { alpha: 0.5 }).stops[1]).toEqual({ offset: 0, color: '#ff0000', alpha: 0.5 })
    expect(cssPreview(redToBlue)).toBe('linear-gradient(to right, rgb(255 0 0 / 1) 0%, rgb(0 0 255 / 0) 100%)')
  })

  it('keeps angles in 0..359', () => {
    expect([0, 90, 360, 450, -90].map(normalAngle)).toEqual([0, 90, 0, 90, 270])
  })
})
