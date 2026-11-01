// "Restart now" on the update banner closes the window through the unsaved-changes question, then installs
// the update. The request must live only as long as that close: if the close does not complete, a later
// close must not install and restart the app.

/** The answer to the unsaved-changes question, in the order of its buttons. */
export type CloseAnswer = 'save' | 'dontSave' | 'cancel'

export class InstallRequest {
  /** The window closes now (no unsaved changes, or "Don't save"): install when it is closed. */
  private onClose = false
  /** "Save" was the answer: install only if the renderer closes the window after a good save. */
  private afterSave = false

  /** "Restart now". */
  request(): void {
    this.onClose = true
    this.afterSave = false
  }

  /**
   * The user answered the unsaved-changes question. A request kept from an earlier "Save" does not count:
   * the window is still open, so that save did not complete.
   */
  answer(answer: CloseAnswer): void {
    const requested = this.onClose
    this.onClose = answer === 'dontSave' && requested
    this.afterSave = answer === 'save' && requested
  }

  /** The renderer saved and closes the window. */
  savedAndClosing(): void {
    this.onClose = this.afterSave
    this.afterSave = false
  }

  /** At the close of the window: install the update? */
  get install(): boolean {
    return this.onClose
  }
}
