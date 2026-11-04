import { Dialog } from 'radix-ui'
import { useTranslation } from 'react-i18next'
import { isLanguage } from '../../../shared/i18n'
import type { Entry } from '../../../shared/whatsNew'
import { safeEntryHtml } from '../whatsNew/content'
import { Button } from './Button'
import styles from './WhatsNewDialog.module.css'

type Props = {
  /** The entries to show, newest first. Null: the dialog is closed. */
  entries: Entry[] | null
  onClose: () => void
}

/** "What's new" after an update, or the full history from the About section (ADR-0033). */
export function WhatsNewDialog({ entries, onClose }: Props) {
  const { t, i18n } = useTranslation()
  const language = isLanguage(i18n.language) ? i18n.language : 'en'
  return (
    <Dialog.Root open={entries !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content} aria-describedby={undefined}>
          <Dialog.Title className={styles.title}>{t('whatsNew.title')}</Dialog.Title>
          <div className={styles.entries}>
            {entries?.map((entry) => (
              <article key={entry.id} className={styles.entry}>
                <span className={`${styles.badge} ${styles[entry.kind]}`}>{t(`whatsNew.${entry.kind}`)}</span>
                {/* Our own Markdown, sanitized with DOMPurify (safeEntryHtml). */}
                <div className={styles.text} dangerouslySetInnerHTML={{ __html: safeEntryHtml(entry, language) }} />
              </article>
            ))}
          </div>
          <div className={styles.actions}>
            <Dialog.Close asChild>
              <Button variant="primary">{t('app.ok')}</Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
