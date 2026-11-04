import { describe, expect, it } from 'vitest'
import type { Gradient, UserLayer } from './document'
import { colorStops, layerBox, linearPoints, paintProps } from './paint'

const base = {
  id: 'a',
  name: 'A',
  visible: true,
  locked: false,
  opacity: 1,
  region: 'base' as const,
  transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }
}
const redToBlue: Gradient = {
  type: 'linear',
  angle: 0,
  stops: [
    { offset: 1, color: '#0000ff', alpha: 0.5 },
    { offset: 0, color: '#ff0000', alpha: 1 }
  ]
}
const rect = (gradient: Gradient | null): UserLayer => ({
  ...base,
  kind: 'rect',
  color: '#123456',
  gradient,
  width: 400,
  height: 200,
  cornerRadius: 0
})

describe('layer paint', () => {
  it('uses the box of the shape, the texture for a fill, and the bounding box of a polygon', () => {
    expect(layerBox(rect(null), 4096, 4096)).toEqual({ x: 0, y: 0, width: 400, height: 200 })
    expect(layerBox({ ...base, kind: 'fill', color: '#000000', gradient: null }, 4096, 2048)).toEqual({
      x: 0,
      y: 0,
      width: 4096,
      height: 2048
    })
    expect(layerBox({ ...base, kind: 'polygon', color: '#000000', gradient: null, points: [10, 50, 110, 20, 60, 90] }, 1, 1)).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 70
    })
  })

  it('makes a linear gradient that touches the corners of the box', () => {
    const box = { x: 0, y: 0, width: 400, height: 200 }
    expect(linearPoints(box, 0)).toEqual({ start: { x: 0, y: 100 }, end: { x: 400, y: 100 } })
    const down = linearPoints(box, 90)
    expect(down.start.x).toBeCloseTo(200)
    expect(down.start.y).toBeCloseTo(0)
    expect(down.end.y).toBeCloseTo(200)
    // 45°: the line is long enough for the corners: (|400·cos| + |200·sin|) / 2 from the centre.
    const diagonal = linearPoints(box, 45)
    expect(Math.hypot(diagonal.end.x - 200, diagonal.end.y - 100)).toBeCloseTo((600 * Math.SQRT1_2) / 2)
  })

  it('sorts the stops and gives rgba colours', () => {
    expect(colorStops(redToBlue)).toEqual([0, 'rgba(255, 0, 0, 1)', 1, 'rgba(0, 0, 255, 0.5)'])
  })

  it('gives a solid fill, a linear or a radial gradient, and the region colour over a gradient', () => {
    expect(paintProps(rect(null), 4096, 4096)).toMatchObject({
      fill: '#123456',
      fillPriority: 'color',
      fillLinearGradientColorStops: undefined
    })
    expect(paintProps(rect(redToBlue), 4096, 4096)).toMatchObject({
      fill: undefined,
      fillPriority: 'linear-gradient',
      fillLinearGradientStartPoint: { x: 0, y: 100 },
      fillLinearGradientEndPoint: { x: 400, y: 100 }
    })
    expect(paintProps(rect({ ...redToBlue, type: 'radial' }), 4096, 4096)).toMatchObject({
      fillPriority: 'radial-gradient',
      fillRadialGradientStartPoint: { x: 200, y: 100 },
      fillRadialGradientStartRadius: 0,
      fillRadialGradientEndRadius: Math.hypot(400, 200) / 2
    })
    expect(paintProps(rect(redToBlue), 4096, 4096, 'rgb(255 0 0)')).toMatchObject({ fill: 'rgb(255 0 0)', fillPriority: 'color' })
  })
})
