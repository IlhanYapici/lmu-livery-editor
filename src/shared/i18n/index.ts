import i18next, { type i18n, type Module } from 'i18next'
import { z } from 'zod'
import en from './en.json'
import fr from './fr.json'

// Translations for the main process and the renderer (ADR-0024). English is the source language;
// the French texts use the words of the French game UI (Livrée, Carte de la région, Carbone, Autocollants).

export const LANGUAGES = ['en', 'fr'] as const
export type Language = (typeof LANGUAGES)[number]

export const resources = { en: { translation: en }, fr: { translation: fr } } as const

export const isLanguage = (value: unknown): value is Language => LANGUAGES.includes(value as Language)

/** The language for a system locale such as "fr-FR": French for any French locale, else English. */
export const languageForLocale = (locale: string): Language => (locale.toLowerCase().startsWith('fr') ? 'fr' : 'en')

/** A new, ready i18next instance (synchronous: the resources are bundled). Plugins must come before init. */
export function createI18n(language: Language, plugins: Module[] = []): i18n {
  const instance = i18next.createInstance()
  for (const plugin of plugins) instance.use(plugin)
  instance.init({ resources, lng: language, fallbackLng: 'en', interpolation: { escapeValue: false }, initAsync: false })
  return instance
}

/** zod messages (project file validation) in the same language. */
export function setValidationLanguage(language: Language): void {
  z.config(language === 'fr' ? z.locales.fr() : z.locales.en())
}
