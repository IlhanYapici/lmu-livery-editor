import { Dialog } from 'radix-ui'
import { useTranslation } from 'react-i18next'
import type { GameLocation } from '../../../shared/api'
import { Button } from './Button'
import styles from './GameFolderDialog.module.css'

type Props = {
  location: Extract<GameLocation, { status: 'found' }>
  onChoose: () => void
  /** Shows the full "What's new" history. */
  onWhatsNew: () => void
}

/** Shows the game folder in use, and lets the user select another one. Also shows the app version (About). */
export function GameFolderDialog({ location, onChoose, onWhatsNew }: Props) {
  const { t } = useTranslation()
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button className={styles.trigger} aria-label={t('gameFolder.button')}>
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden>
            <path d="M3 6h7l2 2h9v11H3z" fill="none" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <Dialog.Title className={styles.title}>{t('gameFolder.title')}</Dialog.Title>
          <Dialog.Description className={styles.description}>
            {t('gameFolder.description', { source: t(`gameFolder.source.${location.source}`) })}
          </Dialog.Description>
          <code className={styles.path}>{location.gameDir}</code>
          <section className={styles.about} aria-labelledby="about-title">
            <h3 id="about-title" className={styles.aboutTitle}>
              {t('about.title')}
            </h3>
            <p>{t('about.version', { version: __APP_VERSION__ })}</p>
            <p>{t('about.licence')}</p>
            <p className={styles.disclaimer}>{t('about.disclaimer')}</p>
            <Dialog.Close asChild>
              <Button onClick={onWhatsNew}>{t('whatsNew.button')}</Button>
            </Dialog.Close>
          </section>
          <div className={styles.actions}>
            <Button onClick={onChoose}>{t('gameFolder.selectAnother')}</Button>
            <Dialog.Close asChild>
              <Button variant="primary">{t('gameFolder.close')}</Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
