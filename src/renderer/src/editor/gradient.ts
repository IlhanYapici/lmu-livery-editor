import { MAX_GRADIENT_STOPS } from '../../../shared/project'
import type { Gradient, GradientStop } from './document'

// Edits of a gradient, as pure functions (ADR-0034). The stops are not kept sorted: the index of a stop stays
// the same while the user drags it past another one. The paint (paint.ts) sorts them.

/** A fade: the layer colour, opaque, to the same colour, transparent. */
export function defaultGradient(type: Gradient['type'], color: string): Gradient {
  return {
    type,
    angle: 0,
    stops: [
      { offset: 0, color, alpha: 1 },
      { offset: 1, color, alpha: 0 }
    ]
  }
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const hex = (channels: number[]) => `#${channels.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
const sorted = (g: Gradient) => [...g.stops].sort((a, b) => a.offset - b.offset)

/** The colour and alpha of the gradient at `offset`, as a canvas gradient computes it (linear, in sRGB). */
export function stopAt(gradient: Gradient, offset: number): GradientStop {
  const stops = sorted(gradient)
  const after = stops.findIndex((s) => s.offset >= offset)
  if (after === -1) return { ...stops[stops.length - 1], offset }
  if (after === 0) return { ...stops[0], offset }
  const a = stops[after - 1]
  const b = stops[after]
  const k = b.offset === a.offset ? 0 : (offset - a.offset) / (b.offset - a.offset)
  const [ca, cb] = [rgb(a.color), rgb(b.color)]
  return { offset, color: hex(ca.map((v, i) => v + (cb[i] - v) * k)), alpha: Math.round((a.alpha + (b.alpha - a.alpha) * k) * 100) / 100 }
}

/** Adds a stop with the colour of the gradient at `offset`. Null when the gradient has the maximum of stops. */
export function addStop(gradient: Gradient, offset: number): { gradient: Gradient; index: number } | null {
  if (gradient.stops.length >= MAX_GRADIENT_STOPS) return null
  const stops = [...gradient.stops, stopAt(gradient, offset)]
  return { gradient: { ...gradient, stops }, index: stops.length - 1 }
}

/** Removes a stop. A gradient keeps at least 2 stops. */
export function removeStop(gradient: Gradient, index: number): Gradient {
  if (gradient.stops.length <= 2) return gradient
  return { ...gradient, stops: gradient.stops.filter((_, i) => i !== index) }
}

export function updateStop(gradient: Gradient, index: number, patch: Partial<GradientStop>): Gradient {
  return { ...gradient, stops: gradient.stops.map((s, i) => (i === index ? { ...s, ...patch } : s)) }
}

/** The gradient from left to right, for the bar in the properties panel (CSS). */
export function cssPreview(gradient: Gradient): string {
  const stops = sorted(gradient).map((s) => {
    const [r, g, b] = rgb(s.color)
    return `rgb(${r} ${g} ${b} / ${s.alpha}) ${Math.round(s.offset * 10000) / 100}%`
  })
  return `linear-gradient(to right, ${stops.join(', ')})`
}

/** An angle in 0..359 degrees. */
export const normalAngle = (degrees: number) => ((degrees % 360) + 360) % 360

/** A value in 0..1. */
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
