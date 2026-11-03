import type { ButtonHTMLAttributes } from 'react'
import styles from './Button.module.css'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** primary: white with dark text ("POURSUIVRE" in the game). secondary: outlined. */
  variant?: 'primary' | 'secondary'
  size?: 'normal' | 'large'
  /** An async action runs: a spinner replaces the label (same width) and the button is disabled. */
  busy?: boolean
}

export function Button({ variant = 'secondary', size = 'normal', busy = false, className, children, disabled, ...props }: Props) {
  return (
    <button
      {...props}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={[styles.button, styles[variant], styles[size], busy && styles.busy, className].filter(Boolean).join(' ')}
    >
      <span className={styles.label}>{children}</span>
      {busy && <span className={styles.spinner} aria-hidden="true" />}
    </button>
  )
}
