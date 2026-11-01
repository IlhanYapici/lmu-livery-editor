import type { ReactNode } from 'react'
import { Toggle } from 'radix-ui'
import { useTranslation } from 'react-i18next'
import type { TemplateNode, Visibility } from '../../../shared/psd/templateRender'
import styles from './TemplatePanel.module.css'

type Props = {
  content: TemplateNode[]
  visibility: Visibility
  insertion: number
  maxInsertion: number
  onVisible: (path: string, visible: boolean) => void
  onInsertion: (insertion: number) => void
}

/** Template content layers, top to bottom like Photoshop, with the "Your layers" row at the insertion point. */
export function TemplatePanel({ content, visibility, insertion, maxInsertion, onVisible, onInsertion }: Props) {
  const { t } = useTranslation()
  const isVisible = (n: TemplateNode) => visibility[n.path] ?? !n.hidden
  const rows: ReactNode[] = []

  const userRow = (
    <div key="user" className={styles.userRow}>
      <span className={styles.userName}>{t('template.yourLayers')}</span>
      <button className={styles.move} onClick={() => onInsertion(insertion + 1)} disabled={insertion >= maxInsertion} aria-label={t('template.moveUp')}>
        ▲
      </button>
      <button className={styles.move} onClick={() => onInsertion(insertion - 1)} disabled={insertion <= 1} aria-label={t('template.moveDown')}>
        ▼
      </button>
    </div>
  )

  // Top to bottom: content[insertion] is the first layer above the user layers, content[insertion - 1] the first below.
  if (insertion === content.length) rows.push(userRow)
  for (let i = content.length - 1; i >= 0; i--) {
    rows.push(<NodeRow key={content[i].path} node={content[i]} depth={0} isVisible={isVisible} onVisible={onVisible} />)
    if (i === insertion) rows.push(userRow)
  }

  return (
    <div className={styles.list}>
      <p className={styles.hint}>{t('template.hint')}</p>
      {rows}
    </div>
  )
}

function NodeRow({ node, depth, isVisible, onVisible }: { node: TemplateNode; depth: number; isVisible: (n: TemplateNode) => boolean; onVisible: (path: string, visible: boolean) => void }) {
  const { t } = useTranslation()
  const visible = isVisible(node)
  return (
    <>
      <div className={styles.row} style={{ paddingLeft: 8 + depth * 20 }}>
        <Toggle.Root className={styles.eye} pressed={visible} onPressedChange={(on) => onVisible(node.path, on)} aria-label={t('template.show', { name: node.name })}>
          <EyeIcon open={visible} />
        </Toggle.Root>
        <span className={visible ? styles.name : `${styles.name} ${styles.hidden}`}>{node.name}</span>
        {node.kind === 'adjustment' && <span className={styles.tag}>{t('template.adjustment')}</span>}
        {node.kind === 'group' && <span className={styles.tag}>{t('template.group')}</span>}
      </div>
      {[...node.children].reverse().map((child) => (
        <NodeRow key={child.path} node={child} depth={depth + 1} isVisible={isVisible} onVisible={onVisible} />
      ))}
    </>
  )
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      {open ? <circle cx="12" cy="12" r="3" fill="currentColor" /> : <path d="M4 20 20 4" stroke="currentColor" strokeWidth="1.6" />}
    </svg>
  )
}
