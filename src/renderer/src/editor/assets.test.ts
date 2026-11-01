import { describe, expect, it } from 'vitest'
import { imageType, importSize, svgSize } from './assets'

describe('image import helpers', () => {
  it('finds the image type from the File type or the file name', () => {
    expect(imageType({ type: 'image/png', name: 'a.bin' })).toBe('image/png')
    expect(imageType({ type: '', name: 'Logo.SVG' })).toBe('image/svg+xml')
    expect(imageType({ type: '', name: 'photo.jpeg' })).toBe('image/jpeg')
    expect(imageType({ type: 'image/gif', name: 'anim.gif' })).toBeNull()
    expect(imageType({ type: '', name: 'noextension' })).toBeNull()
  })

  it('takes the SVG size from width and height, else its viewBox, else 1024 × 1024', () => {
    expect(svgSize('<svg width="120" height="60px" viewBox="0 0 400 100">')).toEqual({ width: 120, height: 60 })
    expect(svgSize('<svg width="50%" height="100%" viewBox="0 0 400 100">')).toEqual({ width: 400, height: 100 })
    expect(svgSize('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200"><rect width="10" height="10"/></svg>')).toEqual({ width: 400, height: 200 })
    expect(svgSize('<svg viewBox="0 0 400 100">')).toEqual({ width: 400, height: 100 })
    expect(svgSize("<svg viewBox='-10,-10, 250.5, 80'>")).toEqual({ width: 251, height: 80 })
    expect(svgSize('<svg>')).toEqual({ width: 1024, height: 1024 })
  })

  it('limits the larger side to 2048 template pixels and keeps the ratio', () => {
    expect(importSize(400, 100)).toEqual({ width: 400, height: 100 })
    expect(importSize(8000, 2000)).toEqual({ width: 2048, height: 512 })
    expect(importSize(1000, 4096)).toEqual({ width: 500, height: 2048 })
  })
})
