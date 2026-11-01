import styles from './WarningIcon.module.css'

/** An orange warning triangle. `label` is the tooltip and the accessible name. */
export function WarningIcon({ label }: { label: string }) {
  return (
    <span className={styles.icon} title={label} role="img" aria-label={label}>
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
        <path d="M12 3 2 21h20z" fill="currentColor" />
        <path d="M12 10v5M12 17.5v.5" stroke="#111" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </span>
  )
}
