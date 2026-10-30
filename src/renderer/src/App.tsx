import { useEffect, useState } from 'react'
import type { Car, Catalogue, Category, GameLocation, TemplateVariant } from '../../shared/api'

// Temporary screens: game detection, then category → car → variant. The game-style UI comes in Phase 3.

const formatSize = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(0)} MB`

export function App() {
  const [location, setLocation] = useState<GameLocation | null>(null)
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null)
  const [category, setCategory] = useState<Category | null>(null)
  const [car, setCar] = useState<Car | null>(null)
  const [variant, setVariant] = useState<TemplateVariant | null>(null)

  useEffect(() => {
    window.lmu.locateGame().then(setLocation)
  }, [])

  useEffect(() => {
    if (location?.status !== 'found') return
    setCatalogue(null)
    window.lmu.listTemplates().then(setCatalogue)
  }, [location])

  const choose = async () => {
    const result = await window.lmu.chooseGameDir()
    if (result.status === 'cancelled') return
    setCategory(null)
    setCar(null)
    setVariant(null)
    setLocation(result)
  }

  const back = () => {
    if (variant) setVariant(null)
    else if (car) setCar(null)
    else setCategory(null)
  }

  return (
    <main style={{ fontFamily: 'system-ui', color: '#eee', background: '#101114', minHeight: '100vh', padding: 24 }}>
      <h1>LMU Livery Editor</h1>

      {location === null && <p>Searching for Le Mans Ultimate…</p>}
      {location?.status === 'found' && (
        <p>
          Game found ({location.source}): <code>{location.gameDir}</code>
        </p>
      )}
      {location?.status === 'not-found' && <p>Le Mans Ultimate was not found. Select its install folder.</p>}
      {location?.status === 'invalid' && (
        <p>
          <code>{location.gameDir}</code> has no <code>support/LiveryTemplates</code> folder.
        </p>
      )}
      {location !== null && <button onClick={choose}>Select game folder…</button>}

      {location?.status === 'found' && catalogue === null && <p>Reading templates…</p>}
      {catalogue && catalogue.length === 0 && <p>No templates found.</p>}

      {catalogue && catalogue.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <p>
            {[category?.name, car?.name, variant?.label].filter(Boolean).join(' › ') || 'Select a category'}
            {category && (
              <button style={{ marginLeft: 12 }} onClick={back}>
                Back
              </button>
            )}
          </p>

          {!category &&
            catalogue.map((c) => (
              <button key={c.id} style={{ display: 'block', margin: '4px 0' }} onClick={() => setCategory(c)}>
                {c.name} ({c.cars.length} cars)
              </button>
            ))}

          {category &&
            !car &&
            category.cars.map((c) => (
              <button key={c.id} style={{ display: 'block', margin: '4px 0' }} onClick={() => setCar(c)}>
                {c.name} ({c.variants.length} variants)
              </button>
            ))}

          {car &&
            !variant &&
            car.variants.map((v) => (
              <button key={v.id} style={{ display: 'block', margin: '4px 0' }} onClick={() => setVariant(v)}>
                {v.label} — {formatSize(v.sizeBytes)}
              </button>
            ))}

          {variant && (
            <p>
              Template: <code>{variant.path}</code>
              <br />
              The editor comes in Phase 3.
            </p>
          )}
        </section>
      )}
    </main>
  )
}
