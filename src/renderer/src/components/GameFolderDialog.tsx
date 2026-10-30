import { Dialog } from 'radix-ui'
import type { GameLocation } from '../../../shared/api'
import { Button } from './Button'
import styles from './GameFolderDialog.module.css'

type Props = {
  location: Extract<GameLocation, { status: 'found' }>
  onChoose: () => void
}

const SOURCE_TEXT = { settings: 'saved setting', auto: 'found automatically', manual: 'selected by you' }

/** Shows the game folder in use, and lets the user select another one. */
export function GameFolderDialog({ location, onChoose }: Props) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button className={styles.trigger} aria-label="Game folder">
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden>
            <path d="M3 6h7l2 2h9v11H3z" fill="none" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <Dialog.Title className={styles.title}>Game folder</Dialog.Title>
          <Dialog.Description className={styles.description}>
            Le Mans Ultimate ({SOURCE_TEXT[location.source]}):
          </Dialog.Description>
          <code className={styles.path}>{location.gameDir}</code>
          <div className={styles.actions}>
            <Button onClick={onChoose}>Select another folder</Button>
            <Dialog.Close asChild>
              <Button variant="primary">Close</Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
