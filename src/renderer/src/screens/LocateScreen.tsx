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
  return (
    <div className={styles.screen}>
      <TopBar title="Livery editor" />
      <main className={styles.main}>
        {location === null ? (
          <p className={styles.text}>Searching for Le Mans Ultimate…</p>
        ) : (
          <section className={styles.panel}>
            <h2 className={styles.heading}>Le Mans Ultimate not found</h2>
            {location.status === 'invalid' ? (
              <p className={styles.text}>
                <code>{location.gameDir}</code> has no <code>support/LiveryTemplates</code> folder. Select the install
                folder of the game.
              </p>
            ) : (
              <p className={styles.text}>Select the install folder of the game, for example <code>…\steamapps\common\Le Mans Ultimate</code>.</p>
            )}
            <Button variant="primary" size="large" onClick={onChoose}>
              Select folder
            </Button>
          </section>
        )}
      </main>
    </div>
  )
}
