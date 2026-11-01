import { ToggleGroup } from 'radix-ui'
import { useTranslation } from 'react-i18next'
import { isLanguage, LANGUAGES } from '../../../shared/i18n'
import { applyLanguage } from '../i18n'
import styles from './LanguageSwitch.module.css'

/** EN | FR in the top bar. The choice is saved in the settings. */
export function LanguageSwitch() {
  const { t, i18n } = useTranslation()
  return (
    <ToggleGroup.Root
      type="single"
      className={styles.group}
      value={i18n.language}
      onValueChange={(language) => isLanguage(language) && void applyLanguage(language, true)}
      aria-label={t('app.language')}
    >
      {LANGUAGES.map((language) => (
        <ToggleGroup.Item key={language} value={language} className={styles.item} lang={language}>
          {language.toUpperCase()}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
