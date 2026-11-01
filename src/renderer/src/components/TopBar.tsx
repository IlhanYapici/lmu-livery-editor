import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitch } from './LanguageSwitch'
import styles from './TopBar.module.css'

type Props = {
  title: string
  /** Shown after the title in the body font, so it keeps its letter case (e.g. a file name). */
  subtitle?: string
  onBack?: () => void
  /** Content in the middle (tabs). */
  center?: ReactNode
  /** Content on the right (buttons). */
  right?: ReactNode
}

export function TopBar({ title, subtitle, onBack, center, right }: Props) {
  const { t } = useTranslation()
  return (
    <header className={styles.bar}>
      <div className={styles.left}>
        <span className={styles.mark} aria-hidden>
          {t('app.mark')}
        </span>
        <button className={styles.back} onClick={onBack} disabled={!onBack} aria-label={t('app.back')}>
          <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden>
            <path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </div>
      <div className={styles.center}>{center}</div>
      <div className={styles.right}>
        {right}
        <LanguageSwitch />
      </div>
    </header>
  )
}
