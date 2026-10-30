import { describe, expect, it } from 'vitest'
import { decodeTga, encodeTga24, readTgaHeader, tgaSize } from './tga'

describe('encodeTga24', () => {
  it('writes the same header as the working game files (4096², 24 bits, bottom-left origin)', () => {
    const bytes = encodeTga24(new Uint8ClampedArray(4096 * 4096 * 4), 4096, 4096)
    // Header read from UserData\Liveries\customskin.tga on the test PC.
    const reference = '00 00 02 00 00 00 00 00 00 00 00 00 00 10 00 10 18 00'
    expect(Array.from(bytes.slice(0, 18), (b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')).toBe(reference.toUpperCase())
    expect(bytes.length).toBe(50_331_666)
    expect(tgaSize(4096, 4096)).toBe(50_331_666)
  })

  it('stores BGR rows from bottom to top, and reads back the same pixels', () => {
    // 2 × 2: top row red, green; bottom row blue, white.
    const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255])
    const bytes = encodeTga24(rgba, 2, 2)
    // First stored row is the bottom row: blue (BGR 255,0,0), white.
    expect(Array.from(bytes.slice(18, 24))).toEqual([255, 0, 0, 255, 255, 255])
    expect(decodeTga(bytes).rgba).toEqual(rgba)
  })

  it('merges transparent pixels over the background', () => {
    const rgba = new Uint8ClampedArray([255, 255, 255, 128, 10, 20, 30, 0])
    const { rgba: back } = decodeTga(encodeTga24(rgba, 2, 1))
    expect(Array.from(back)).toEqual([128, 128, 128, 255, 0, 0, 0, 255])
  })

  it('refuses pixel data of the wrong size', () => {
    expect(() => encodeTga24(new Uint8ClampedArray(4), 2, 2)).toThrow()
  })
})

describe('readTgaHeader', () => {
  it('refuses compressed, colour-mapped, short or odd-depth files', () => {
    const good = encodeTga24(new Uint8ClampedArray(16), 2, 2)
    expect(readTgaHeader(good)).toEqual({ width: 2, height: 2, bitsPerPixel: 24, topOrigin: false })
    const rle = good.slice(); rle[2] = 10
    expect(() => readTgaHeader(rle)).toThrow(/uncompressed/)
    const depth = good.slice(); depth[16] = 16
    expect(() => readTgaHeader(depth)).toThrow(/depth/)
    expect(() => readTgaHeader(good.slice(0, 20))).toThrow(/shorter/)
  })
})
