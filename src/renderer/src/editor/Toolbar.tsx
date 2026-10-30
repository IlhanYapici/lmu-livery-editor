import type { ReactNode } from 'react'
import { ToggleGroup, Tooltip } from 'radix-ui'
import type { Tool } from './EditorCanvas'
import styles from './Toolbar.module.css'

const TOOLS: { tool: Tool; label: string; key: string; icon: string }[] = [
  { tool: 'select', label: 'Select and move', key: 'V', icon: 'M5 3l13 8-6 1.5L9.5 19z' },
  { tool: 'rect', label: 'Rectangle (drag)', key: 'R', icon: 'M4 6h16v12H4z' },
  { tool: 'polygon', label: 'Polygon (click points, double-click or Enter to close)', key: 'P', icon: 'M12 3l8 6-3 11H7L4 9z' },
  { tool: 'text', label: 'Text (click to place)', key: 'T', icon: 'M5 5h14M12 5v14' }
]

type Props = { tool: Tool; onTool: (tool: Tool) => void; onAddFill: () => void }

export function Toolbar({ tool, onTool, onAddFill }: Props) {
  return (
    <Tooltip.Provider delayDuration={300}>
      <div className={styles.bar}>
        <ToggleGroup.Root type="single" value={tool} onValueChange={(v) => v && onTool(v as Tool)} className={styles.group} aria-label="Tools" orientation="vertical">
          {TOOLS.map((t) => (
            <Tip key={t.tool} text={`${t.label} · ${t.key}`}>
              <ToggleGroup.Item value={t.tool} className={styles.button} aria-label={t.label}>
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
                  <path d={t.icon} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                </svg>
              </ToggleGroup.Item>
            </Tip>
          ))}
        </ToggleGroup.Root>
        <Tip text="Add a fill layer at the bottom of your layers">
          <button className={styles.button} onClick={onAddFill} aria-label="Add fill">
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
