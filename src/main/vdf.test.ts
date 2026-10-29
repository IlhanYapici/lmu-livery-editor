import { describe, expect, it } from 'vitest'
import { parseVdf } from './vdf'

describe('parseVdf', () => {
  it('parses nested objects', () => {
    const text = `"libraryfolders"
{
	"0"
	{
		"path"		"C:\\\\Program Files (x86)\\\\Steam"
		"apps"
		{
			"228980"		"420591244"
		}
	}
}`
    expect(parseVdf(text)).toEqual({
      libraryfolders: { '0': { path: 'C:\\Program Files (x86)\\Steam', apps: { '228980': '420591244' } } }
    })
  })

  it('handles comments, escaped quotes and unquoted tokens', () => {
    const text = `// comment
"a" "say \\"hi\\""
b { c d }`
    expect(parseVdf(text)).toEqual({ a: 'say "hi"', b: { c: 'd' } })
  })

  it('rejects malformed input', () => {
    expect(() => parseVdf('"a" { "b" "c"')).toThrow(/missing "}"/)
    expect(() => parseVdf('"a" "b" }')).toThrow(/unexpected/)
    expect(() => parseVdf('"a')).toThrow(/unterminated/)
    expect(() => parseVdf('"a"')).toThrow(/missing value/)
  })
})
