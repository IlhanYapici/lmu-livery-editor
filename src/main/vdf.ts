// Parser for Valve KeyValues text files (.vdf), e.g. steamapps/libraryfolders.vdf.

export type VdfObject = { [key: string]: string | VdfObject }

type Token = { kind: 'string' | 'open' | 'close'; value: string }

function* tokenize(text: string): Generator<Token> {
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (/\s/.test(c)) {
      i++
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++
    } else if (c === '{') {
      yield { kind: 'open', value: c }
      i++
    } else if (c === '}') {
      yield { kind: 'close', value: c }
      i++
    } else if (c === '"') {
      let value = ''
      i++
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\\' && i + 1 < text.length) {
          const next = text[i + 1]
          value += next === 'n' ? '\n' : next === 't' ? '\t' : next
          i += 2
        } else {
          value += text[i++]
        }
      }
      if (i >= text.length) throw new Error('VDF: unterminated string')
      i++
      yield { kind: 'string', value }
    } else {
      // Unquoted token: read up to whitespace or brace.
      let value = ''
      while (i < text.length && !/[\s{}"]/.test(text[i])) value += text[i++]
      yield { kind: 'string', value }
    }
  }
}

export function parseVdf(text: string): VdfObject {
  const tokens = [...tokenize(text)]
  let pos = 0

  function parseObject(nested: boolean): VdfObject {
    const obj: VdfObject = {}
    while (pos < tokens.length) {
      const key = tokens[pos++]
      if (key.kind === 'close') {
        if (!nested) throw new Error('VDF: unexpected "}"')
        return obj
      }
      if (key.kind !== 'string') throw new Error('VDF: expected a key')
      const value = tokens[pos++]
      if (!value) throw new Error(`VDF: missing value for "${key.value}"`)
      if (value.kind === 'open') obj[key.value] = parseObject(true)
      else if (value.kind === 'string') obj[key.value] = value.value
      else throw new Error(`VDF: unexpected "}" after "${key.value}"`)
    }
    if (nested) throw new Error('VDF: missing "}"')
    return obj
  }

  return parseObject(false)
}
