import type { Catalogue } from '../shared/api'
import { TEMPLATE_PROTOCOL } from '../shared/api'

// The renderer reads template files through `lmu-template://template/<file name>`.
// Only file names of the current catalogue resolve, so the renderer cannot read other files (ADR-0005).

/** Returns the path of the requested template, or null if the URL does not name a catalogue template. */
export function resolveTemplateUrl(url: string, catalogue: Catalogue): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== `${TEMPLATE_PROTOCOL}:` || parsed.hostname !== 'template') return null
  const name = decodeURIComponent(parsed.pathname.replace(/^\//, ''))
  for (const category of catalogue)
    for (const car of category.cars)
      for (const variant of car.variants) if (variant.id === name) return variant.path
  return null
}
