import { useTranslation } from 'react-i18next'
import type { GameLocation } from '../../../shared/api'
import { Button } from '../components/Button'
import { TopBar } from '../components/TopBar'
import styles from './LocateScreen.module.css'

type Props = {
  location: Extract<GameLocation, { status: 'not-found' | 'invalid' }> | null
  onChoose: () => void
}

/** Shown while the app looks for the game, and when it cannot find it. */
export function LocateScreen({ location, onChoose }: Props) {
  const { t } = useTranslation()
  return (
    <div className={styles.screen}>
      <TopBar title={t('locate.title')} />
      <main className={styles.main}>
        {location === null ? (
          <p className={styles.text}>{t('locate.searching')}</p>
        ) : (
          <section className={styles.panel}>
            <h2 className={styles.heading}>{t('locate.notFound')}</h2>
            {location.status === 'invalid' ? (
              <p className={styles.text}>{t('locate.invalid', { folder: location.gameDir })}</p>
            ) : (
              <p className={styles.text}>{t('locate.selectHint')}</p>
            )}
            <Button variant="primary" size="large" onClick={onChoose}>
              {t('locate.selectFolder')}
            </Button>
          </section>
        )}
      </main>
    </div>
  )
}
