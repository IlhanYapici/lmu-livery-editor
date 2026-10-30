import { classColor } from '../classColors'
import styles from './ClassBadge.module.css'

/** Short class name on the class colour, like the badge next to the car name in the game showroom. */
export function ClassBadge({ categoryId, shortName }: { categoryId: string; shortName: string }) {
  return (
    <span className={styles.badge} style={{ background: classColor(categoryId) }}>
      {shortName}
    </span>
  )
}
