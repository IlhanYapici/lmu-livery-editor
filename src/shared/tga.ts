// TGA files for the game (ADR-0022). The working files in UserData\Liveries are TGA 1.0: image type 2
// (uncompressed true colour), 24 bits per pixel (BGR, no alpha), rows from bottom to top, no footer.

export const TGA_HEADER_BYTES = 18

export const tgaSize = (width: number, height: number) => TGA_HEADER_BYTES + width * height * 3

/**
 * Encodes RGBA pixels (rows from top to bottom) as a 24-bit TGA. Alpha is merged over `background`
 * (default black), because the game files have no alpha channel.
 */
export function encodeTga24(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number, background: [number, number, number] = [0, 0, 0]): Uint8Array<ArrayBuffer> {
  if (rgba.length !== width * height * 4) throw new Error('encodeTga24: pixel data does not match the size')
  const out = new Uint8Array(tgaSize(width, height))
  out[2] = 2 // uncompressed true colour
  out[12] = width & 0xff
  out[13] = width >> 8
  out[14] = height & 0xff
  out[15] = height >> 8
  out[16] = 24 // bits per pixel
  out[17] = 0 // no alpha bits, origin bottom left
  let o = TGA_HEADER_BYTES
  for (let y = height - 1; y >= 0; y--) {
    let i = y * width * 4
    for (let x = 0; x < width; x++, i += 4, o += 3) {
      const a = rgba[i + 3]
      if (a === 255) {
        out[o] = rgba[i + 2]
        out[o + 1] = rgba[i + 1]
        out[o + 2] = rgba[i]
      } else {
        const k = a / 255
        out[o] = Math.round(rgba[i + 2] * k + background[2] * (1 - k))
        out[o + 1] = Math.round(rgba[i + 1] * k + background[1] * (1 - k))
        out[o + 2] = Math.round(rgba[i] * k + background[0] * (1 - k))
      }
    }
  }
  return out
}

export type TgaInfo = { width: number; height: number; bitsPerPixel: number; topOrigin: boolean }

/** Reads and checks the header of an uncompressed true-colour TGA (24 or 32 bits). */
export function readTgaHeader(bytes: Uint8Array): TgaInfo {
  if (bytes.length < TGA_HEADER_BYTES) throw new Error('not a TGA file: too short')
  if (bytes[1] !== 0 || bytes[2] !== 2) throw new Error('not an uncompressed true-colour TGA')
  const width = bytes[12] | (bytes[13] << 8)
  const height = bytes[14] | (bytes[15] << 8)
  const bitsPerPixel = bytes[16]
  if (bitsPerPixel !== 24 && bitsPerPixel !== 32) throw new Error(`unsupported TGA depth: ${bitsPerPixel} bits`)
  const expected = TGA_HEADER_BYTES + bytes[0] + width * height * (bitsPerPixel / 8)
  if (bytes.length < expected) throw new Error('TGA file is shorter than its header says')
  return { width, height, bitsPerPixel, topOrigin: (bytes[17] & 0x20) !== 0 }
}

/** Decodes an uncompressed 24/32-bit TGA to RGBA rows from top to bottom (used by tests and checks). */
export function decodeTga(bytes: Uint8Array): { width: number; height: number; rgba: Uint8ClampedArray } {
  const { width, height, bitsPerPixel, topOrigin } = readTgaHeader(bytes)
  const step = bitsPerPixel / 8
  const rgba = new Uint8ClampedArray(width * height * 4)
  let o = TGA_HEADER_BYTES + bytes[0]
  for (let row = 0; row < height; row++) {
    const y = topOrigin ? row : height - 1 - row
    for (let x = 0; x < width; x++, o += step) {
      const i = (y * width + x) * 4
      rgba[i] = bytes[o + 2]
      rgba[i + 1] = bytes[o + 1]
      rgba[i + 2] = bytes[o]
      rgba[i + 3] = step === 4 ? bytes[o + 3] : 255
    }
  }
  return { width, height, rgba }
}
