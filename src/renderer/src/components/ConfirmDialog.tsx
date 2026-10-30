import { AlertDialog } from 'radix-ui'
import type { ReactNode } from 'react'
import { Button } from './Button'
import styles from './ConfirmDialog.module.css'

export type DialogAction = { label: string; primary?: boolean; onSelect: () => void }

type Props = {
  open: boolean
  title: string
  children: ReactNode
  /** The last action is the cancel action (Escape selects it). */
  actions: DialogAction[]
}

/**
 * A modal question or message, in the style of the game panels. The parent controls `open`; each action
 * closes the dialog through its own handler. (Radix also calls onOpenChange after an action, so the cancel
 * handler runs only from the cancel button and the Escape key.)
 */
export function ConfirmDialog({ open, title, children, actions }: Props) {
  const cancel = actions[actions.length - 1]
  return (
    <AlertDialog.Root open={open}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={styles.overlay} />
        <AlertDialog.Content className={styles.content} onEscapeKeyDown={cancel.onSelect}>
          <AlertDialog.Title className={styles.title}>{title}</AlertDialog.Title>
          <AlertDialog.Description asChild>
            <div className={styles.body}>{children}</div>
          </AlertDialog.Description>
          <div className={styles.actions}>
            {actions.map((action, i) =>
              i === actions.length - 1 ? (
                <AlertDialog.Cancel key={action.label} asChild>
                  <Button variant={action.primary ? 'primary' : 'secondary'} onClick={action.onSelect}>
                    {action.label}
                  </Button>
                </AlertDialog.Cancel>
              ) : (
                <AlertDialog.Action key={action.label} asChild>
                  <Button variant={action.primary ? 'primary' : 'secondary'} onClick={action.onSelect}>
                    {action.label}
                  </Button>
                </AlertDialog.Action>
              )
            )}
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
