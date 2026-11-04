// Links in the app (for example in "What's new" entries) open in the system browser, never in the app
// window: the window must keep the editor (ADR-0033).

/** True for a link that the system browser may open: https only. */
export function isExternalLink(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}
