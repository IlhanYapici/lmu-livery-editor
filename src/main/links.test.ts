import { describe, expect, it } from 'vitest'
import { isExternalLink } from './links'

describe('external links', () => {
  it('opens https links only', () => {
    expect(isExternalLink('https://github.com/IlhanYapici/lmu-livery-editor')).toBe(true)
    expect(isExternalLink('http://example.com')).toBe(false)
    expect(isExternalLink('file:///C:/Windows/System32/calc.exe')).toBe(false)
    expect(isExternalLink('javascript:alert(1)')).toBe(false)
    expect(isExternalLink('lmu-template://template/a.psd')).toBe(false)
    expect(isExternalLink('not a url')).toBe(false)
  })
})
