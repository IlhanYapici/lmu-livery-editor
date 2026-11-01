import { describe, expect, it } from 'vitest'
import { InstallRequest } from './installRequest'

describe('InstallRequest', () => {
  it('no "Restart now": a close never installs', () => {
    const request = new InstallRequest()
    request.answer('dontSave')
    expect(request.install).toBe(false)
    request.answer('save')
    request.savedAndClosing()
    expect(request.install).toBe(false)
  })

  it('"Restart now" without unsaved changes: installs at the close', () => {
    const request = new InstallRequest()
    request.request()
    expect(request.install).toBe(true)
  })

  it('"Don\'t save": installs at the close', () => {
    const request = new InstallRequest()
    request.request()
    request.answer('dontSave')
    expect(request.install).toBe(true)
  })

  it('"Save", then a good save: installs at the close', () => {
    const request = new InstallRequest()
    request.request()
    request.answer('save')
    expect(request.install).toBe(false)
    request.savedAndClosing()
    expect(request.install).toBe(true)
  })

  it('"Save", then the save fails or is cancelled: a later close does not install', () => {
    const request = new InstallRequest()
    request.request()
    request.answer('save')
    // No savedAndClosing: the window stays open. Later the user saves (Ctrl+S) and closes, or answers again.
    expect(request.install).toBe(false)
    request.answer('dontSave')
    expect(request.install).toBe(false)
    request.answer('save')
    request.savedAndClosing()
    expect(request.install).toBe(false)
  })

  it('"Cancel": a later close does not install', () => {
    const request = new InstallRequest()
    request.request()
    request.answer('cancel')
    expect(request.install).toBe(false)
    request.answer('dontSave')
    expect(request.install).toBe(false)
  })
})
