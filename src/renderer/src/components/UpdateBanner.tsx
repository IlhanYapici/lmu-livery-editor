import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './Button'
import styles from './UpdateBanner.module.css'

/** Shows when an update is downloaded. "Later" hides it: the update then installs when the app quits. */
export function UpdateBanner() {
  const { t } = useTranslation()
  const [version, setVersion] = useState<string | null>(null)
  useEffect(() => window.lmu.onUpdateReady(setVersion), [])
  if (!version) return null
  return (
    <div className={styles.banner} role="status">
      <span>{t('update.ready', { version })}</span>
      <Button variant="primary" onClick={() => window.lmu.installUpdate()}>
        {t('update.restart')}
      </Button>
      <Button onClick={() => setVersion(null)}>{t('update.later')}</Button>
    </div>
  )
}
