import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Catalogue, GameLocation } from '../../shared/api'
import { isValidationKey, parseProject, verifyAssets, type ProjectError } from '../../shared/project'
import { Button } from './components/Button'
import { ConfirmDialog } from './components/ConfirmDialog'
import { GameFolderDialog } from './components/GameFolderDialog'
import { TopBar } from './components/TopBar'
import type { InitialProject } from './editor/documentStore'
import { EditorScreen, type EditorGuard } from './screens/EditorScreen'
import { LocateScreen } from './screens/LocateScreen'
import { SelectScreen, type Selection } from './screens/SelectScreen'
import { i18n } from './i18n'
import styles from './App.module.css'

/** A project error in the UI language. Custom schema messages are translation keys. */
function projectErrorText(error: ProjectError): string {
  const t = i18n.t
  switch (error.code) {
    case 'newerVersion':
      return t('project.error.newerVersion', { version: error.version })
    case 'field':
      return t('project.error.field', { path: error.path, message: isValidationKey(error.message) ? t(error.message) : error.message })
    case 'assetHash':
    case 'assetTooLarge':
      return t(`project.error.${error.code}`, { id: error.id.slice(0, 12) })
    default:
      return t(`project.error.${error.code}`)
  }
}

/** The editor session. `key` changes for each opened project, so that the editor starts again. */
type Editing = { key: number; project: InitialProject | null; templateChanged: boolean }

type Message = { title: string; lines: string[] }

export function App() {
  const { t } = useTranslation()
  const [location, setLocation] = useState<GameLocation | null>(null)
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState<Message | null>(null)
  /** The action that waits for the answer to "Save changes?". */
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null)
  const guard = useRef<EditorGuard | null>(null)
  const showSaveError = useCallback((lines: string[]) => setMessage({ title: i18n.t('project.cannotSave'), lines }), [])

  useEffect(() => {
    window.lmu.locateGame().then(setLocation)
  }, [])

  useEffect(() => {
    if (location?.status !== 'found') return
    window.lmu.listTemplates().then((next) => {
      setCatalogue(next)
      const first = next[0]?.cars[0]
      setSelection(first ? { categoryId: next[0].id, carId: first.id, variantId: first.variants[0].id } : null)
      setEditing(null)
    })
  }, [location])

  /** Runs `action` now, or after the user answers the "Save changes?" question. */
  const leaveEditor = useCallback((action: () => void) => {
    if (guard.current?.hasUnsavedChanges()) setPendingLeave(() => action)
    else action()
  }, [])

  const openProject = useCallback(async () => {
    if (!catalogue) return
    const result = await window.lmu.openProject()
    if (result.status === 'cancelled') return
    if (result.status === 'error') return setMessage({ title: t('project.cannotOpen'), lines: [result.message] })
    const parsed = parseProject(result.text)
    if (!parsed.ok)
      return setMessage({ title: t('project.cannotOpen'), lines: [t('project.invalid', { file: result.fileName }), ...parsed.errors.slice(0, 8).map(projectErrorText)] })

    const assetErrors = await verifyAssets(parsed.project.document)
    if (assetErrors.length)
      return setMessage({ title: t('project.cannotOpen'), lines: [t('project.invalid', { file: result.fileName }), ...assetErrors.slice(0, 8).map(projectErrorText)] })

    const { template, document } = parsed.project
    for (const category of catalogue)
      for (const car of category.cars)
        for (const variant of car.variants)
          if (variant.id === template.id) {
            setSelection({ categoryId: category.id, carId: car.id, variantId: variant.id })
            setEditing({
              key: Date.now(),
              project: { doc: document, handle: result.handle, fileName: result.fileName },
              templateChanged: variant.sizeBytes !== template.sizeBytes
            })
            return
          }
    setMessage({
      title: t('project.templateMissingTitle'),
      lines: [t('project.templateMissing', { file: result.fileName, template: template.id }), t('project.templateMissingHelp')]
    })
  }, [catalogue, t])

  const openWithGuard = useCallback(() => leaveEditor(() => void openProject()), [leaveEditor, openProject])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'o') {
        e.preventDefault()
        openWithGuard()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openWithGuard])

  const choose = async () => {
    const result = await window.lmu.chooseGameDir()
    if (result.status !== 'cancelled')
      leaveEditor(() => {
        setCatalogue(null) // Shows "Reading templates…" until the new list arrives.
        setLocation(result)
      })
  }

  if (location?.status !== 'found') {
    return <LocateScreen location={location?.status === 'not-found' || location?.status === 'invalid' ? location : null} onChoose={choose} />
  }

  const right = (
    <>
      <Button onClick={openWithGuard} disabled={!catalogue} title={t('app.openProjectHint')}>
        {t('app.openProject')}
      </Button>
      <GameFolderDialog location={location} onChoose={choose} />
    </>
  )
  const category = catalogue?.find((c) => c.id === selection?.categoryId)
  const car = category?.cars.find((c) => c.id === selection?.carId)
  const variant = car?.variants.find((v) => v.id === selection?.variantId)

  const dialogs = (
    <>
      <ConfirmDialog
        open={pendingLeave !== null}
        title={t('project.unsavedTitle')}
        actions={[
          {
            label: t('app.save'),
            primary: true,
            onSelect: async () => {
              const action = pendingLeave
              setPendingLeave(null)
              if (await guard.current?.save()) action?.()
            }
          },
          {
            label: t('app.dontSave'),
            onSelect: () => {
              const action = pendingLeave
              setPendingLeave(null)
              action?.()
            }
          },
          { label: t('app.cancel'), onSelect: () => setPendingLeave(null) }
        ]}
      >
        <p>{t('project.unsavedText')}</p>
      </ConfirmDialog>
      <ConfirmDialog open={message !== null} title={message?.title ?? ''} actions={[{ label: t('app.ok'), primary: true, onSelect: () => setMessage(null) }]}>
        {message && message.lines.length > 1 ? (
          <>
            <p>{message.lines[0]}</p>
            <ul>
              {message.lines.slice(1).map((line) => (
                <li key={line}>
                  <code>{line}</code>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>{message?.lines[0]}</p>
        )}
      </ConfirmDialog>
    </>
  )

  if (editing && category && car && variant) {
    return (
      <div className={styles.app}>
        <TopBar title={t('editor.title')} subtitle={title} onBack={() => leaveEditor(() => setEditing(null))} right={right} />
        <EditorScreen
          key={editing.key}
          category={category}
          car={car}
          variant={variant}
          project={editing.project}
          templateChanged={editing.templateChanged}
          guardRef={guard}
          onTitle={setTitle}
          onError={showSaveError}
        />
        {dialogs}
      </div>
    )
  }

  return (
    <div className={styles.app}>
      <TopBar title={t('select.title')} right={right} />
      {catalogue === null && <p className={styles.message}>{t('select.readingTemplates')}</p>}
      {catalogue?.length === 0 && <p className={styles.message}>{t('select.noTemplates')}</p>}
      {catalogue && catalogue.length > 0 && selection && (
        <SelectScreen catalogue={catalogue} selection={selection} onSelect={setSelection} onContinue={() => setEditing({ key: Date.now(), project: null, templateChanged: false })} />
      )}
      {dialogs}
    </div>
  )
}
