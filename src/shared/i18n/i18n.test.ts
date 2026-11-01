import { describe, expect, it } from 'vitest'
import en from './en.json'
import fr from './fr.json'
import { createI18n, languageForLocale } from '.'

type Tree = { [key: string]: string | Tree }

/** "a.b.c" → text, for every leaf. */
function flatten(tree: Tree, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') out[path] = value
    else flatten(value, path, out)
  }
  return out
}

const variables = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort()

describe('translations', () => {
  const english = flatten(en)
  const french = flatten(fr)

  it('have the same keys in English and French', () => {
    expect(Object.keys(french).sort()).toEqual(Object.keys(english).sort())
  })

  it('use the same variables in each text', () => {
    for (const key of Object.keys(english)) expect([key, variables(french[key])]).toEqual([key, variables(english[key])])
  })

  it('have no empty text', () => {
    for (const [key, text] of Object.entries({ ...english, ...french })) expect([key, text.trim().length > 0]).toEqual([key, true])
  })

  it('pick the language from the system locale', () => {
    expect(languageForLocale('fr-FR')).toBe('fr')
    expect(languageForLocale('fr')).toBe('fr')
    expect(languageForLocale('en-GB')).toBe('en')
    expect(languageForLocale('de-DE')).toBe('en')
  })

  it('translate with plurals and variables', () => {
    const t = createI18n('fr').t
    expect(t('select.variantCount', { count: 1 })).toBe('1 variante')
    expect(t('select.variantCount', { count: 3 })).toBe('3 variantes')
    expect(createI18n('en').t('select.variantCount', { count: 1 })).toBe('1 variant')
  })
})
