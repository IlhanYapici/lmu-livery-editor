// Makes a fake game folder with the synthetic templates, to try the editor without Le Mans Ultimate.
// Usage: npm run dev:game -- [folder] [size]   (defaults: .dev-game, 2048 px)
// Then select the printed folder as the game folder in the app. The app keeps it in its settings.
import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { writeTemplates } from '../tests/fixtures/templates.ts'

const [folderArg, sizeArg] = process.argv.slice(2)
const game = resolve(folderArg ?? '.dev-game')
const size = Number(sizeArg ?? 2048)
if (!Number.isInteger(size) || size < 64 || size > 4096) {
  console.error(`Size must be an integer from 64 to 4096 px, not "${sizeArg}"`)
  process.exit(1)
}

const start = performance.now()
const files = await writeTemplates(join(game, 'support', 'LiveryTemplates'), size)
await mkdir(join(game, 'UserData'), { recursive: true })
console.log(`${files.length} templates of ${size} × ${size} px in ${Math.round(performance.now() - start)} ms`)
console.log(`Game folder: ${game}`)
