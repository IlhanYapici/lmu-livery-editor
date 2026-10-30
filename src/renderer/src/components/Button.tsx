import type { ButtonHTMLAttributes } from 'react'
import styles from './Button.module.css'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** primary: white with dark text ("POURSUIVRE" in the game). secondary: outlined. */
  variant?: 'primary' | 'secondary'
  size?: 'normal' | 'large'
}

export function Button({ variant = 'secondary', size = 'normal', className, ...props }: Props) {
  return <button {...props} className={[styles.button, styles[variant], styles[size], className].filter(Boolean).join(' ')} />
}
