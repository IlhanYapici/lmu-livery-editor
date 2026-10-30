import type { BlendMode, Layer, LayerEffectsInfo, LevelsAdjustmentChannel, PixelData } from 'ag-psd'

// A small layer compositor for LMU templates. It supports the features that the templates use:
// pixel layers, groups (pass through or isolated), opacity, fill opacity, layer masks, clipping masks,
// separable blend modes, the "color overlay" effect and Levels adjustments.
// Every other feature is skipped and recorded in `unsupported`, so the caller can see what is missing.

export type Raster = { left: number; top: number; width: number; height: number; data: Uint8ClampedArray }

/** Decodes pixels on request, so only one layer is decoded at a time. */
export interface LayerDecoder {
  pixels(layer: Layer): PixelData | undefined
  mask(layer: Layer): PixelData | undefined
}

export type CompositeOptions = {
  width: number
  height: number
  decoder: LayerDecoder
  /** Default: the visibility saved in the PSD. */
  isVisible?: (layer: Layer) => boolean
}

export type CompositeResult = { image: Raster; unsupported: Map<string, number> }

type Context = Required<CompositeOptions> & { unsupported: Map<string, number> }

const note = (ctx: Context, feature: string) => ctx.unsupported.set(feature, (ctx.unsupported.get(feature) ?? 0) + 1)

export function createRaster(left: number, top: number, width: number, height: number): Raster {
  return { left, top, width, height, data: new Uint8ClampedArray(width * height * 4) }
}

// --- Blend modes (W3C Compositing and Blending Level 1, plus Photoshop "linear burn", "lighter/darker color") ---

/** Separable modes work per channel. "lighter/darker color" pick the whole source or backdrop colour. */
type BlendFn = ((cb: number, cs: number) => number) & { whole?: 'lighter' | 'darker' }

const whole = (kind: 'lighter' | 'darker'): BlendFn => Object.assign((_cb: number, cs: number) => cs, { whole: kind })

const BLEND: Partial<Record<BlendMode, BlendFn>> = {
  normal: (_cb, cs) => cs,
  'pass through': (_cb, cs) => cs,
  multiply: (cb, cs) => cb * cs,
  screen: (cb, cs) => cb + cs - cb * cs,
  darken: (cb, cs) => Math.min(cb, cs),
  lighten: (cb, cs) => Math.max(cb, cs),
  'linear dodge': (cb, cs) => Math.min(1, cb + cs),
  'linear burn': (cb, cs) => Math.max(0, cb + cs - 1),
  'color dodge': (cb, cs) => (cb === 0 ? 0 : cs === 1 ? 1 : Math.min(1, cb / (1 - cs))),
  'color burn': (cb, cs) => (cb === 1 ? 1 : cs === 0 ? 0 : 1 - Math.min(1, (1 - cb) / cs)),
  overlay: (cb, cs) => hardLight(cs, cb),
  'hard light': (cb, cs) => hardLight(cb, cs),
  'soft light': (cb, cs) => {
    if (cs <= 0.5) return cb - (1 - 2 * cs) * cb * (1 - cb)
    const d = cb <= 0.25 ? ((16 * cb - 12) * cb + 4) * cb : Math.sqrt(cb)
    return cb + (2 * cs - 1) * (d - cb)
  },
  difference: (cb, cs) => Math.abs(cb - cs),
  exclusion: (cb, cs) => cb + cs - 2 * cb * cs,
  'lighter color': whole('lighter'),
  'darker color': whole('darker')
}

function hardLight(cb: number, cs: number): number {
  return cs <= 0.5 ? cb * 2 * cs : cb + (2 * cs - 1) - cb * (2 * cs - 1)
}

function blendFn(ctx: Context, mode: BlendMode | undefined): BlendFn {
  const fn = BLEND[mode ?? 'normal']
  if (fn) return fn
  note(ctx, `blend:${mode}`)
  return BLEND.normal!
}

/** For "lighter/darker color": true if the source colour wins over the backdrop colour. */
function sourceWins(kind: 'lighter' | 'darker', d: Uint8ClampedArray, di: number, s: Uint8ClampedArray, si: number): boolean {
  const lum = (a: Uint8ClampedArray, i: number) => 0.3 * a[i] + 0.59 * a[i + 1] + 0.11 * a[i + 2]
  return kind === 'lighter' ? lum(s, si) > lum(d, di) : lum(s, si) < lum(d, di)
}

/**
 * Draws `src` onto `dst`. `coverage(x, y)` scales the source alpha (opacity × mask).
 * With `keepAlpha`, the destination alpha does not change (clipping mask).
 */
function drawRaster(
  dst: Raster,
  src: Raster,
  blend: BlendFn,
  opacity: number,
  coverage: ((x: number, y: number) => number) | null,
  keepAlpha = false
): void {
  const x0 = Math.max(dst.left, src.left)
  const y0 = Math.max(dst.top, src.top)
  const x1 = Math.min(dst.left + dst.width, src.left + src.width)
  const y1 = Math.min(dst.top + dst.height, src.top + src.height)
  const d = dst.data
  const s = src.data
  const isNormal = blend === BLEND.normal

  for (let y = y0; y < y1; y++) {
    let di = ((y - dst.top) * dst.width + (x0 - dst.left)) * 4
    let si = ((y - src.top) * src.width + (x0 - src.left)) * 4
    for (let x = x0; x < x1; x++, di += 4, si += 4) {
      let as = (s[si + 3] / 255) * opacity
      if (as === 0) continue
      if (coverage) {
        as *= coverage(x, y)
        if (as === 0) continue
      }
      const ab = d[di + 3] / 255
      const ao = keepAlpha ? ab : as + ab * (1 - as)
      if (ao === 0) continue
      const keepBackdrop = blend.whole !== undefined && !sourceWins(blend.whole, d, di, s, si)
      for (let c = 0; c < 3; c++) {
        const cb = d[di + c] / 255
        let cs = s[si + c] / 255
        if (keepBackdrop) cs = (1 - ab) * cs + ab * cb
        else if (!isNormal) cs = (1 - ab) * cs + ab * blend(cb, cs)
        const co = keepAlpha ? cb + (cs - cb) * as : (cs * as + cb * ab * (1 - as)) / ao
        d[di + c] = Math.round(co * 255)
      }
      d[di + 3] = Math.round(ao * 255)
    }
  }
}

// --- Masks ---

function maskCoverage(ctx: Context, layer: Layer): ((x: number, y: number) => number) | null {
  const mask = layer.mask
  if (!mask || mask.disabled) return null
  // Mask coordinates are absolute in the file; "positionRelativeToLayer" only links the mask to the layer.
  const outside = (mask.defaultColor ?? 0) / 255
  const data = ctx.decoder.mask(layer)
  if (!data) return () => outside
  const left = mask.left ?? 0
  const top = mask.top ?? 0
  const step = data.data.length / (data.width * data.height)
  return (x, y) => {
    const mx = x - left
    const my = y - top
    if (mx < 0 || my < 0 || mx >= data.width || my >= data.height) return outside
    return data.data[(my * data.width + mx) * step] / 255
  }
}

// --- Effects ---

function enabledEffects(effects: LayerEffectsInfo | undefined): string[] {
  if (!effects || effects.disabled) return []
  const names: string[] = []
  for (const [key, value] of Object.entries(effects)) {
    if (key === 'disabled' || key === 'scale') continue
    for (const fx of Array.isArray(value) ? value : [value]) if (fx?.enabled) names.push(key)
  }
  return names
}

/** Applies the supported effects to the layer raster and records the others. */
function applyEffects(ctx: Context, layer: Layer, raster: Raster): void {
  for (const name of enabledEffects(layer.effects)) {
    if (name !== 'solidFill') note(ctx, `effect:${name}`)
  }
  for (const fill of layer.effects?.solidFill ?? []) {
    if (!fill.enabled || layer.effects?.disabled) continue
    const color = fill.color as { r?: number; g?: number; b?: number } | undefined
    if (!color || color.r === undefined) {
      note(ctx, 'effect:solidFill:non-rgb')
      continue
    }
    if (fill.blendMode && fill.blendMode !== 'normal') note(ctx, `effect:solidFill:blend:${fill.blendMode}`)
    const rgb = [color.r, color.g!, color.b!]
    const opacity = fill.opacity ?? 1
    const d = raster.data
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue
      for (let c = 0; c < 3; c++) d[i + c] = Math.round(d[i + c] + (rgb[c] - d[i + c]) * opacity)
    }
  }
}

// --- Adjustments ---

export function levelsTable({ shadowInput, highlightInput, shadowOutput, highlightOutput, midtoneInput }: LevelsAdjustmentChannel): Uint8Array {
  const table = new Uint8Array(256)
  const range = Math.max(1, highlightInput - shadowInput)
  for (let v = 0; v < 256; v++) {
    const t = Math.min(1, Math.max(0, (v - shadowInput) / range)) ** (1 / (midtoneInput || 1))
    table[v] = Math.round(shadowOutput + t * (highlightOutput - shadowOutput))
  }
  return table
}

const isIdentityLevels = (c: LevelsAdjustmentChannel) =>
  c.shadowInput === 0 && c.highlightInput === 255 && c.shadowOutput === 0 && c.highlightOutput === 255 && c.midtoneInput === 1

/** Changes one RGB colour (0..1) in place. */
type ColorTransform = (rgb: number[]) => void

function levelsTransform(ctx: Context, adjustment: Extract<Layer['adjustment'], { type: 'levels' }>): ColorTransform | null {
  const [rgb, ...perChannel] = adjustment.channels ?? []
  if (perChannel.some((c) => c && !isIdentityLevels(c))) note(ctx, 'adjustment:levels:per-channel')
  if (!rgb) return null
  const table = levelsTable(rgb)
  return (c) => {
    for (let i = 0; i < 3; i++) c[i] = table[Math.round(c[i] * 255)] / 255
  }
}

function rgbToHsl([r, g, b]: number[]): [number, number, number] {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}

function hslToRgb(h: number, s: number, l: number, out: number[]): void {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const channel = (t: number) => {
    t = ((t % 360) + 360) % 360
    if (t < 60) return p + ((q - p) * t) / 60
    if (t < 180) return q
    if (t < 240) return p + ((q - p) * (240 - t)) / 60
    return p
  }
  out[0] = channel(h + 120)
  out[1] = channel(h)
  out[2] = channel(h - 120)
}

/** Master hue/saturation/lightness only. Photoshop's exact algorithm is not public; this is the HSL model. */
function hueSaturationTransform(ctx: Context, adjustment: Extract<Layer['adjustment'], { type: 'hue/saturation' }>): ColorTransform | null {
  if (adjustment.colorize) note(ctx, 'adjustment:hue/saturation:colorize')
  const ranges = [adjustment.reds, adjustment.yellows, adjustment.greens, adjustment.cyans, adjustment.blues, adjustment.magentas]
  if (ranges.some((r) => r && (r.hue || r.saturation || r.lightness))) note(ctx, 'adjustment:hue/saturation:ranges')
  const { hue = 0, saturation = 0, lightness = 0 } = adjustment.master ?? {}
  if (!hue && !saturation && !lightness) return null
  const sat = saturation / 100
  const light = lightness / 100
  return (c) => {
    let [h, s, l] = rgbToHsl(c)
    h += hue
    s = sat < 0 ? s * (1 + sat) : s + (1 - s) * sat
    l = light < 0 ? l * (1 + light) : l + (1 - l) * light
    hslToRgb(h, Math.min(1, s), Math.min(1, l), c)
  }
}

/**
 * Brightness/contrast. Photoshop's modern algorithm is not public. The brightness curve
 * 1 - (1 - v)^(1 + b/100) was fitted on the only template that uses it (Lexus RC F: brightness +30,
 * contrast -15; RMS error 2.1 levels). Adding any contrast model made that fit worse, so contrast is
 * not applied and is recorded as unsupported.
 */
function brightnessContrastTransform(ctx: Context, adjustment: Extract<Layer['adjustment'], { type: 'brightness/contrast' }>): ColorTransform | null {
  if (adjustment.useLegacy) note(ctx, 'adjustment:brightness/contrast:legacy')
  if (adjustment.contrast) note(ctx, 'adjustment:brightness/contrast:contrast')
  const exponent = 1 + Math.abs(adjustment.brightness ?? 0) / 100
  if (exponent === 1) return null
  const brighten = (adjustment.brightness ?? 0) > 0
  return (c) => {
    for (let i = 0; i < 3; i++) c[i] = brighten ? 1 - (1 - c[i]) ** exponent : c[i] ** exponent
  }
}

function adjustmentTransform(ctx: Context, layer: Layer): ColorTransform | null {
  const adjustment = layer.adjustment!
  switch (adjustment.type) {
    case 'levels':
      return levelsTransform(ctx, adjustment)
    case 'hue/saturation':
      return hueSaturationTransform(ctx, adjustment)
    case 'brightness/contrast':
      return brightnessContrastTransform(ctx, adjustment)
    default:
      note(ctx, `adjustment:${adjustment.type}`)
      return null
  }
}

function applyAdjustment(ctx: Context, layer: Layer, dst: Raster): void {
  const transform = adjustmentTransform(ctx, layer)
  if (!transform) return
  const coverage = maskCoverage(ctx, layer)
  const opacity = layer.opacity ?? 1
  const d = dst.data
  const color = [0, 0, 0]
  for (let y = 0; y < dst.height; y++) {
    for (let x = 0; x < dst.width; x++) {
      const i = (y * dst.width + x) * 4
      if (d[i + 3] === 0) continue
      const k = opacity * (coverage ? coverage(x + dst.left, y + dst.top) : 1)
      if (k === 0) continue
      color[0] = d[i] / 255
      color[1] = d[i + 1] / 255
      color[2] = d[i + 2] / 255
      transform(color)
      for (let c = 0; c < 3; c++) d[i + c] = Math.round(d[i + c] + (color[c] * 255 - d[i + c]) * k)
    }
  }
}

// --- Layers and groups ---

function layerRaster(ctx: Context, layer: Layer): Raster | null {
  if (layer.children) {
    const raster = createRaster(0, 0, ctx.width, ctx.height)
    drawLayers(ctx, layer.children, raster)
    return raster
  }
  const pixels = ctx.decoder.pixels(layer)
  if (!pixels || pixels.width === 0 || pixels.height === 0) return null
  if (!(pixels.data instanceof Uint8ClampedArray || pixels.data instanceof Uint8Array)) {
    note(ctx, 'pixels:not-8-bit')
    return null
  }
  const step = pixels.data.length / (pixels.width * pixels.height)
  const data = step === 4 ? new Uint8ClampedArray(pixels.data) : new Uint8ClampedArray(pixels.width * pixels.height * 4)
  if (step !== 4) note(ctx, `pixels:${step}-channels`)
  return { left: layer.left ?? 0, top: layer.top ?? 0, width: pixels.width, height: pixels.height, data }
}

/** A pass-through group draws its children into its parent, so adjustments inside it change the layers below. */
function isPassThrough(layer: Layer, clipped: Layer[]): boolean {
  return (
    !!layer.children &&
    (layer.blendMode ?? 'pass through') === 'pass through' &&
    enabledEffects(layer.effects).length === 0 &&
    clipped.length === 0
  )
}

/**
 * Pass-through group with opacity or a mask: draw the children onto a copy of the backdrop, then mix
 * the copy back through opacity × mask (e.g. the "Clamp" group: Levels + Hue/Saturation under a group mask).
 */
function drawPassThrough(ctx: Context, layer: Layer, dst: Raster): void {
  const opacity = layer.opacity ?? 1
  const coverage = maskCoverage(ctx, layer)
  if (opacity === 1 && !coverage) {
    drawLayers(ctx, layer.children!, dst)
    return
  }
  const copy: Raster = { ...dst, data: new Uint8ClampedArray(dst.data) }
  drawLayers(ctx, layer.children!, copy)
  const d = dst.data
  for (let y = 0; y < dst.height; y++) {
    for (let x = 0; x < dst.width; x++) {
      const k = opacity * (coverage ? coverage(x + dst.left, y + dst.top) : 1)
      if (k === 0) continue
      const i = (y * dst.width + x) * 4
      for (let c = 0; c < 4; c++) d[i + c] = Math.round(d[i + c] + (copy.data[i + c] - d[i + c]) * k)
    }
  }
}

function drawLayers(ctx: Context, layers: Layer[], dst: Raster): void {
  // ag-psd lists layers bottom to top. A clipped layer belongs to the nearest non-clipped layer below it.
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i]
    const clipped: Layer[] = []
    while (i + 1 < layers.length && layers[i + 1].clipping) clipped.push(layers[++i])
    if (layer.clipping) note(ctx, 'clipping:without-base')
    if (!ctx.isVisible(layer)) continue

    if (layer.adjustment) {
      if (clipped.length) note(ctx, 'clipping:on-adjustment')
      applyAdjustment(ctx, layer, dst)
      continue
    }
    if (isPassThrough(layer, clipped)) {
      drawPassThrough(ctx, layer, dst)
      continue
    }

    const raster = layerRaster(ctx, layer)
    if (!raster) continue
    if ((layer.fillOpacity ?? 1) < 1 && !layer.children) {
      const k = layer.fillOpacity!
      for (let p = 3; p < raster.data.length; p += 4) raster.data[p] = Math.round(raster.data[p] * k)
    }
    applyEffects(ctx, layer, raster)

    for (const clip of clipped) {
      if (!ctx.isVisible(clip)) continue
      if (clip.adjustment) {
        note(ctx, 'clipping:adjustment')
        continue
      }
      const clipRaster = layerRaster(ctx, clip)
      if (!clipRaster) continue
      applyEffects(ctx, clip, clipRaster)
      drawRaster(raster, clipRaster, blendFn(ctx, clip.blendMode), clip.opacity ?? 1, maskCoverage(ctx, clip), true)
    }

    drawRaster(dst, raster, blendFn(ctx, layer.blendMode), layer.opacity ?? 1, maskCoverage(ctx, layer))
  }
}

export function compositeLayers(layers: Layer[], options: CompositeOptions): CompositeResult {
  const ctx: Context = { isVisible: (l) => !l.hidden, ...options, unsupported: new Map() }
  const image = createRaster(0, 0, options.width, options.height)
  drawLayers(ctx, layers, image)
  return { image, unsupported: ctx.unsupported }
}
