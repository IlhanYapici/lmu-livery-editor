import { Dialog } from 'radix-ui'
import { useTranslation } from 'react-i18next'
import type { GameLocation } from '../../../shared/api'
import { Button } from './Button'
import styles from './GameFolderDialog.module.css'

type Props = {
  location: Extract<GameLocation, { status: 'found' }>
  onChoose: () => void
}

/** Shows the game folder in use, and lets the user select another one. */
export function GameFolderDialog({ location, onChoose }: Props) {
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
