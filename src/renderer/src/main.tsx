import '@fontsource/bebas-neue/400.css'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import '@fontsource/oswald/400.css'
import './styles/tokens.css'
import './styles/global.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { applyLanguage } from './i18n'

// Apply the saved language before the first render, so the UI never shows the wrong language.
window.lmu.getLanguage().then(async (language) => {
  await applyLanguage(language, false)
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
})
