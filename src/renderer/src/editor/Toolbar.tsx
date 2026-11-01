import type { ReactNode } from 'react'
import { ToggleGroup, Tooltip } from 'radix-ui'
import { useTranslation } from 'react-i18next'
import type { Tool } from './EditorCanvas'
import styles from './Toolbar.module.css'

const TOOLS: { tool: Tool; key: string; icon: string }[] = [
  { tool: 'select', key: 'V', icon: 'M5 3l13 8-6 1.5L9.5 19z' },
  { tool: 'rect', key: 'R', icon: 'M4 6h16v12H4z' },
  { tool: 'polygon', key: 'P', icon: 'M12 3l8 6-3 11H7L4 9z' },
  { tool: 'text', key: 'T', icon: 'M5 5h14M12 5v14' }
]

type Props = { tool: Tool; onTool: (tool: Tool) => void; onAddFill: () => void; onAddImage: () => void }

export function Toolbar({ tool, onTool, onAddFill, onAddImage }: Props) {
  const { t } = useTranslation()
  return (
    <Tooltip.Provider delayDuration={300}>
      <div className={styles.bar}>
        <ToggleGroup.Root
          type="single"
          value={tool}
          onValueChange={(v) => v && onTool(v as Tool)}
          className={styles.group}
          aria-label={t('tools.label')}
          orientation="vertical"
        >
          {TOOLS.map((item) => (
            <Tip key={item.tool} text={`${t(`tools.${item.tool}`)} · ${item.key}`}>
              <ToggleGroup.Item value={item.tool} className={styles.button} aria-label={t(`tools.${item.tool}`)}>
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
                  <path d={item.icon} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                </svg>
              </ToggleGroup.Item>
            </Tip>
          ))}
        </ToggleGroup.Root>
        <Tip text={`${t('tools.imageHint')} · I`}>
          <button className={styles.button} onClick={onAddImage} aria-label={t('tools.image')}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
              <path d="M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              <circle cx="15.5" cy="9" r="1.5" fill="currentColor" />
            </svg>
          </button>
        </Tip>
        <Tip text={t('tools.addFillHint')}>
          <button className={styles.button} onClick={onAddFill} aria-label={t('tools.addFill')}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
              <path d="M4 4h16v16H4z" fill="currentColor" opacity="0.85" />
            </svg>
          </button>
        </Tip>
      </div>
    </Tooltip.Provider>
  )
}

function Tip({ text, children }: { text: string; children: ReactNode }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side="right" sideOffset={6} className={styles.tip}>
          {text}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
