import { z } from 'zod'
import { REGION_IDS } from './psd/regions'

// zod tries `new Function` for faster validation; the renderer CSP blocks it and logs an error. Do not try.
z.config({ jitless: true })

// The livery document and the project file (.lmulivery). The zod schemas are the single source of the
// document types and of the validation of files from outside the app (ADR-0021).

export const PROJECT_FORMAT = 'lmu-livery'
export const PROJECT_VERSION = 1
export const PROJECT_EXTENSION = 'lmulivery'
/** The main process refuses larger files before it reads them. */
export const MAX_PROJECT_BYTES = 20 * 1024 * 1024
export const MAX_LAYERS = 2000

export const FONTS = ['Bebas Neue', 'Oswald', 'Roboto'] as const

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be a #rrggbb colour')
const coordinate = z.number().min(-100_000).max(100_000)

const transformSchema = z.object({
  x: coordinate,
  y: coordinate,
  rotation: z.number().min(-36_000).max(36_000),
  scaleX: z.number().min(-1000).max(1000),
  scaleY: z.number().min(-1000).max(1000)
})

const layerBase = {
  id: z.string().min(1).max(100),
  name: z.string().max(200),
  visible: z.boolean(),
  locked: z.boolean(),
  opacity: z.number().min(0).max(1),
  region: z.enum(REGION_IDS),
  color,
  transform: transformSchema
}

const fillSchema = z.object({ ...layerBase, kind: z.literal('fill') })
const rectSchema = z.object({
  ...layerBase,
  kind: z.literal('rect'),
  width: z.number().positive().max(100_000),
  height: z.number().positive().max(100_000),
  cornerRadius: z.number().min(0).max(100_000)
})
const polygonSchema = z.object({
  ...layerBase,
  kind: z.literal('polygon'),
  points: z
    .array(coordinate)
    .min(6, 'needs at least 3 points')
    .max(20_000)
    .refine((p) => p.length % 2 === 0, 'needs an even number of coordinates')
})
const textSchema = z.object({
  ...layerBase,
  kind: z.literal('text'),
  text: z.string().max(1000),
  fontFamily: z.enum(FONTS),
  fontSize: z.number().positive().max(10_000),
  outline: z.object({ color, width: z.number().min(0).max(1000) }).nullable()
})

export const userLayerSchema = z.discriminatedUnion('kind', [fillSchema, rectSchema, polygonSchema, textSchema])

export const documentSchema = z.object({
  version: z.literal(1),
  templateId: z.string().min(1).max(500),
  insertion: z.number().int().min(0).max(10_000).nullable(),
  templateVisibility: z.record(z.string().regex(/^\d+(\/\d+)*$/, 'must be a layer index path'), z.boolean()),
  layers: z
    .array(userLayerSchema)
    .max(MAX_LAYERS)
    .refine((layers) => new Set(layers.map((l) => l.id)).size === layers.length, 'layer IDs must be unique')
})

export const projectSchema = z.object({
  format: z.literal(PROJECT_FORMAT),
  version: z.literal(PROJECT_VERSION),
  savedAt: z.string().max(100),
  template: z.object({ id: z.string().min(1).max(500), sizeBytes: z.number().int().min(0) }),
  document: documentSchema
})

export type Transform = z.infer<typeof transformSchema>
export type FillLayer = z.infer<typeof fillSchema>
export type RectLayer = z.infer<typeof rectSchema>
export type PolygonLayer = z.infer<typeof polygonSchema>
export type TextLayer = z.infer<typeof textSchema>
export type UserLayer = z.infer<typeof userLayerSchema>
export type LayerKind = UserLayer['kind']
export type LiveryDocument = z.infer<typeof documentSchema>
export type ProjectFile = z.infer<typeof projectSchema>

export type ParseResult = { ok: true; project: ProjectFile } | { ok: false; errors: string[] }

/** "layers.3.region" → "layers[3].region" */
const pathText = (path: PropertyKey[]) =>
  path.reduce<string>((text, key) => (typeof key === 'number' ? `${text}[${key}]` : text ? `${text}.${String(key)}` : String(key)), '')

/** Reads a project file. Never trust it: it comes from outside the app. */
export function parseProject(text: string): ParseResult {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, errors: ['The file is not valid JSON.'] }
  }
  const head = json as { format?: unknown; version?: unknown }
  if (typeof json !== 'object' || json === null || head.format !== PROJECT_FORMAT) {
    return { ok: false, errors: ['The file is not an LMU livery project.'] }
  }
  if (typeof head.version === 'number' && head.version > PROJECT_VERSION) {
    return { ok: false, errors: [`The file was made with a newer version of the app (format version ${head.version}). Update the app.`] }
  }
  const result = projectSchema.safeParse(json)
  if (!result.success) {
    return { ok: false, errors: result.error.issues.map((issue) => `${pathText(issue.path) || 'file'}: ${issue.message}`) }
  }
  if (result.data.document.templateId !== result.data.template.id) {
    return { ok: false, errors: ['document.templateId: does not match template.id'] }
  }
  return { ok: true, project: result.data }
}

export function serializeProject(document: LiveryDocument, templateSizeBytes: number, now = new Date()): string {
  const project: ProjectFile = {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    savedAt: now.toISOString(),
    template: { id: document.templateId, sizeBytes: templateSizeBytes },
    document
  }
  return JSON.stringify(project, null, 2)
}
