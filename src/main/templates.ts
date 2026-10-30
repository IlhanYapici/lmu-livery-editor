import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { Catalogue, Category, TemplateVariant } from '../shared/api'

// Builds the category → car → variant tree from the PSD file names in support/LiveryTemplates.
// The names are not regular (e.g. "FordMustang_EVO_LMGT3", "McLaren720EVO_2025 _ELMS", "Oreca07_ELMS_2025"),
// so variant tokens are found by value, not by position.

/** `code`: token in the file names. `name` and `shortName`: as the game shows them (selection tabs, badges). */
const CLASSES: { code: string; name: string; shortName: string }[] = [
  { code: 'HYPER', name: 'Hypercar', shortName: 'HY' },
  { code: 'LMP2', name: 'LMP2', shortName: 'P2' },
  { code: 'LMP3', name: 'LMP3', shortName: 'P3' },
  { code: 'GT3', name: 'LMGT3', shortName: 'GT3' },
  { code: 'GTE', name: 'LMGTE', shortName: 'GTE' }
]
const OTHER_CLASS = { code: 'OTHER', name: 'Other', shortName: '?' }

const CAR_NAMES: Record<string, string> = {
  'GT3:AstonMartinVantage': 'Aston Martin Vantage',
  'GT3:BMWM4LMGT3': 'BMW M4 LMGT3',
  'GT3:CorvetteZ06LMGT3': 'Corvette Z06 LMGT3',
  'GT3:Ferrari296LMGT3': 'Ferrari 296 LMGT3',
  'GT3:FordMustangLMGT3': 'Ford Mustang LMGT3',
  'GT3:LamborghiniHuracan': 'Lamborghini Huracán',
  'GT3:LexusRCF': 'Lexus RC F',
  'GT3:McLaren720EVO': 'McLaren 720S EVO',
  'GT3:MercedesAMG': 'Mercedes-AMG',
  'GT3:Porsche911LMGT3R': 'Porsche 911 LMGT3 R',
  'GTE:AstonMartinVantage': 'Aston Martin Vantage',
  'GTE:CorvetteC8R': 'Corvette C8.R',
  'GTE:Ferrari488': 'Ferrari 488 GTE',
  'GTE:PorscheRSR': 'Porsche 911 RSR',
  'HYPER:AlpineA424': 'Alpine A424',
  'HYPER:AstonMartinValkyrie': 'Aston Martin Valkyrie',
  'HYPER:BMWMHybrid': 'BMW M Hybrid V8',
  'HYPER:CadillacVSeries': 'Cadillac V-Series.R',
  'HYPER:Ferrari499P': 'Ferrari 499P',
  'HYPER:GenesisGMR001': 'Genesis GMR-001',
  'HYPER:GlickenhausSCG007': 'Glickenhaus SCG 007',
  'HYPER:IsottaFraschiniTipo6': 'Isotta Fraschini Tipo 6',
  'HYPER:LamborghiniSC63': 'Lamborghini SC63',
  'HYPER:Peugeot9x8': 'Peugeot 9X8',
  'HYPER:Porsche963': 'Porsche 963',
  'HYPER:ToyotaGR010': 'Toyota GR010 / TR010',
  'HYPER:Vanwall680': 'Vanwall Vandervell 680',
  'LMP2:Oreca07': 'Oreca 07',
  'LMP3:ADESSAD25': 'ADESS AD25',
  'LMP3:DuqueineD09': 'Duqueine D09',
  'LMP3:GinettaG61Evo': 'Ginetta G61 Evo',
  'LMP3:LigierJSP325': 'Ligier JS P325'
}

/** Cars that changed name between seasons. The variant keeps the new name in its label. */
const CAR_ALIASES: Record<string, { car: string; label: string }> = {
  'HYPER:ToyotaTR010': { car: 'ToyotaGR010', label: 'TR010' }
}

export type ParsedTemplate = {
  classCode: string
  carKey: string
  year: number | null
  evo: boolean
  elms: boolean
  /** Extra text for the variant label, e.g. the new name of a renamed car. */
  note: string | null
}

/** Parses "Template_<CLASS>_<tokens>.psd". Returns null if the name does not have this form. */
export function parseTemplateName(fileName: string): ParsedTemplate | null {
  const match = fileName.match(/^Template_(.+)\.psd$/i)
  if (!match) return null
  const tokens = match[1]
    .split('_')
    .map((t) => t.trim())
    .filter(Boolean)
  if (tokens.length < 2) return null

  const classCode = tokens[0].toUpperCase()
  let year: number | null = null
  let evo = false
  let elms = false
  const carTokens: string[] = []
  for (const token of tokens.slice(1)) {
    if (/^\d{4}$/.test(token)) year = Number(token)
    else if (token.toUpperCase() === 'EVO') evo = true
    else if (token.toUpperCase() === 'ELMS') elms = true
    else carTokens.push(token)
  }
  if (carTokens.length === 0) return null

  let carKey = carTokens.join('')
  let note: string | null = null
  const alias = CAR_ALIASES[`${classCode}:${carKey}`]
  if (alias) {
    carKey = alias.car
    note = alias.label
  }
  return { classCode, carKey, year, evo, elms, note }
}

export function variantLabel({ year, evo, elms, note }: ParsedTemplate): string {
  const parts = [evo && 'EVO', year, elms && 'ELMS', note].filter(Boolean)
  return parts.length ? parts.join(' ') : 'Base'
}

/** Base first, then by year. An EVO without a year is a later update, so it goes last. */
function variantOrder(p: ParsedTemplate): number[] {
  return [p.year ?? (p.evo ? Infinity : 0), p.evo ? 1 : 0, p.elms ? 1 : 0]
}

function compareOrder(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return 0
}

export type TemplateFile = { name: string; path: string; sizeBytes: number }

export function buildCatalogue(files: TemplateFile[]): Catalogue {
  const categories = new Map<string, Category>()
  const orders = new Map<string, number[]>()

  for (const file of files) {
    const parsed = parseTemplateName(file.name)
    const known = parsed && CLASSES.find((c) => c.code === parsed.classCode)
    const cls = known ?? OTHER_CLASS
    // Files that do not parse still appear, under "Other", with their raw name.
    const carKey = parsed?.carKey ?? file.name.replace(/\.psd$/i, '')
    const carId = `${parsed?.classCode ?? cls.code}:${carKey}`

    let category = categories.get(cls.code)
    if (!category) {
      category = { id: cls.code, name: cls.name, shortName: cls.shortName, cars: [] }
      categories.set(cls.code, category)
    }
    let car = category.cars.find((c) => c.id === carId)
    if (!car) {
      car = { id: carId, name: CAR_NAMES[carId] ?? carKey, variants: [] }
      category.cars.push(car)
    }

    const variant: TemplateVariant = {
      id: file.name,
      label: parsed ? variantLabel(parsed) : file.name,
      path: file.path,
      sizeBytes: file.sizeBytes
    }
    car.variants.push(variant)
    orders.set(file.name, parsed ? variantOrder(parsed) : [Infinity])
  }

  const classOrder = [...CLASSES, OTHER_CLASS].map((c) => c.code)
  return [...categories.values()]
    .sort((a, b) => classOrder.indexOf(a.id) - classOrder.indexOf(b.id))
    .map((category) => ({
      ...category,
      cars: category.cars
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((car) => ({
          ...car,
          variants: car.variants.sort((a, b) => compareOrder(orders.get(a.id)!, orders.get(b.id)!))
        }))
    }))
}

export async function scanTemplates(templatesDir: string): Promise<Catalogue> {
  const names = (await readdir(templatesDir)).filter((n) => n.toLowerCase().endsWith('.psd'))
  const files = await Promise.all(
    names.map(async (name) => {
      const path = join(templatesDir, name)
      return { name, path, sizeBytes: (await stat(path)).size }
    })
  )
  return buildCatalogue(files)
}
