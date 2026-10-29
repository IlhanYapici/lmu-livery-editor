import { useEffect, useState } from 'react'
import type { GameLocation } from '../../shared/api'

// Phase 1 screen: shows the game detection result. The game-style UI comes in Phase 3.
export function App() {
  const [location, setLocation] = useState<GameLocation | null>(null)

  useEffect(() => {
    window.lmu.locateGame().then(setLocation)
  }, [])

  const choose = async () => {
    const result = await window.lmu.chooseGameDir()
    if (result.status !== 'cancelled') setLocation(result)
  }

  return (
    <main style={{ fontFamily: 'system-ui', color: '#eee', background: '#101114', minHeight: '100vh', padding: 24 }}>
      <h1>LMU Livery Editor</h1>
      {location === null && <p>Searching for Le Mans Ultimate…</p>}
      {location?.status === 'found' && (
        <p>
          Game found ({location.source}): <code>{location.gameDir}</code>
          <br />
          Templates: <code>{location.templatesDir}</code>
        </p>
      )}
      {location?.status === 'not-found' && <p>Le Mans Ultimate was not found. Select its install folder.</p>}
      {location?.status === 'invalid' && (
        <p>
          <code>{location.gameDir}</code> has no <code>support/LiveryTemplates</code> folder.
        </p>
      )}
      {location !== null && <button onClick={choose}>Select game folder…</button>}
    </main>
  )
}
