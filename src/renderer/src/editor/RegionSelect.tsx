import { Select } from 'radix-ui'
import { REGIONS, type RegionId } from '../../../shared/psd/regions'
import styles from './RegionSelect.module.css'

const swatch = (rgb: number[]) => ({ background: `rgb(${rgb.join(' ')})` })

/** The region of a user layer, with the colour of each region of the region map. */
export function RegionSelect({ value, onChange }: { value: RegionId; onChange: (region: RegionId) => void }) {
  const current = REGIONS.find((r) => r.id === value)!
  return (
    <Select.Root value={value} onValueChange={(v) => onChange(v as RegionId)}>
      <Select.Trigger className={styles.trigger} aria-label="Region">
        <span className={styles.swatch} style={swatch(current.rgb)} />
        <Select.Value />
        <Select.Icon className={styles.icon}>▾</Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className={styles.content} position="popper" sideOffset={4}>
          <Select.Viewport>
            {REGIONS.map((r) => (
              <Select.Item key={r.id} value={r.id} className={styles.item}>
                <span className={styles.swatch} style={swatch(r.rgb)} />
                <Select.ItemText>{r.name}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}
