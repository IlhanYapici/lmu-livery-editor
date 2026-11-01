import { initReactI18next } from 'react-i18next'
import { createI18n, setValidationLanguage, type Language } from '../../shared/i18n'

// The renderer i18next instance (ADR-0024). English until main.tsx applies the saved language.
export const i18n = createI18n('en', [initReactI18next])

/** Applies a language to the UI, the validation messages and the main process dialogs. */
export async function applyLanguage(language: Language, save: boolean): Promise<void> {
  await i18n.changeLanguage(language)
  setValidationLanguage(language)
  document.documentElement.lang = language
  if (save) await window.lmu.setLanguage(language)
}

const numberFormat = (digits: number) => new Intl.NumberFormat(i18n.language, { minimumFractionDigits: digits, maximumFractionDigits: digits })

/** "3.7 s" / "3,7 s" */
export const formatSeconds = (ms: number) => i18n.t('units.seconds', { value: numberFormat(1).format(ms / 1000) })

/** "28 MB" / "28 Mo" */
export const formatMegabytes = (bytes: number) => i18n.t('units.megabytes', { value: numberFormat(0).format(bytes / 1048576) })
