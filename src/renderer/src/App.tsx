import { useEffect, useState } from 'react'
import type { Catalogue, GameLocation } from '../../shared/api'
import { GameFolderDialog } from './components/GameFolderDialog'
import { TopBar } from './components/TopBar'
import { EditorScreen } from './screens/EditorScreen'
import { LocateScreen } from './screens/LocateScreen'
import { SelectScreen, type Selection } from './screens/SelectScreen'
import styles from './App.module.css'

export function App() {
  const [location, setLocation] = useState<GameLocation | null>(null)
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    window.lmu.locateGame().then(setLocation)
  }, [])

  useEffect(() => {
    if (location?.status !== 'found') return
    setCatalogue(null)
    window.lmu.listTemplates().then((next) => {
      setCatalogue(next)
      const first = next[0]?.cars[0]
      setSelection(first ? { categoryId: next[0].id, carId: first.id, variantId: first.variants[0].id } : null)
      setEditing(false)
    })
  }, [location])

  const choose = async () => {
    const result = await window.lmu.chooseGameDir()
    if (result.status !== 'cancelled') setLocation(result)
  }

  if (location?.status !== 'found') {
    return <LocateScreen location={location?.status === 'not-found' || location?.status === 'invalid' ? location : null} onChoose={choose} />
  }

  const folderButton = <GameFolderDialog location={location} onChoose={choose} />
  const category = catalogue?.find((c) => c.id === selection?.categoryId)
  const car = category?.cars.find((c) => c.id === selection?.carId)
  const variant = car?.variants.find((v) => v.id === selection?.variantId)

  if (editing && category && car && variant) {
    return (
      <div className={styles.app}>
        <TopBar title="Edit livery" onBack={() => setEditing(false)} right={folderButton} />
        <EditorScreen category={category} car={car} variant={variant} />
      </div>
    )
  }

  return (
    <div className={styles.app}>
      <TopBar title="Select a template" right={folderButton} />
      {catalogue === null && <p className={styles.message}>Reading templates…</p>}
      {catalogue?.length === 0 && <p className={styles.message}>No templates in the game folder.</p>}
      {catalogue && catalogue.length > 0 && selection && (
        <SelectScreen catalogue={catalogue} selection={selection} onSelect={setSelection} onContinue={() => setEditing(true)} />
      )}
    </div>
  )
}
