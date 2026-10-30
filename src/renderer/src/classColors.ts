/** CSS variable of the class colour for a category ID (class code). */
const CLASS_COLOR: Record<string, string> = {
  HYPER: 'var(--class-hy)',
  LMP2: 'var(--class-p2)',
  LMP3: 'var(--class-p3)',
  GT3: 'var(--class-gt3)',
  GTE: 'var(--class-gte)'
}

export const classColor = (categoryId: string) => CLASS_COLOR[categoryId] ?? 'var(--class-other)'
