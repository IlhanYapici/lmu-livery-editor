import type { ReactNode } from 'react'
import styles from './TopBar.module.css'

type Props = {
  title: string
  onBack?: () => void
  /** Content in the middle (tabs). */
  center?: ReactNode
  /** Content on the right (buttons). */
  right?: ReactNode
}

export function TopBar({ title, onBack, center, right }: Props) {
  return (
    <header className={styles.bar}>
      <div className={styles.left}>
        <span className={styles.mark} aria-hidden>
          LIVERY
        </span>
        <button className={styles.back} onClick={onBack} disabled={!onBack} aria-label="Back">
          <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden>
            <path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>
        <h1 className={styles.title}>{title}</h1>
      </div>
      <div className={styles.center}>{center}</div>
      <div className={styles.right}>{right}</div>
    </header>
  )
}
