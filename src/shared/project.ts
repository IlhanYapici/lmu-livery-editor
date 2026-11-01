import { z } from 'zod'
import { REGION_IDS } from './psd/regions'

// zod tries `new Function` for faster validation; the renderer CSP blocks it and logs an error. Do not try.
z.config({ jitless: true })

// The livery document and the project file (.lmulivery). The zod schemas are the single source of the
// document types and of the validation of files from outside the app (ADR-0021).

export const PROJECT_FORMAT = 'lmu-livery'
export const PROJECT_VERSION = 2
export const PROJECT_EXTENSION = 'lmulivery'
/** The main process refuses larger files before it reads them. Images are embedded (ADR-0025). */
export const MAX_PROJECT_BYTES = 100 * 1024 * 1024
export const MAX_LAYERS = 2000

/** Imported images. SVG is drawn through <img>, where Chromium runs no script and loads nothing. */
export const ASSET_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'] as const
export type AssetType = (typeof ASSET_TYPES)[number]
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024
export const MAX_IMAGE_PIXELS = 8192

export const FONTS = ['Bebas Neue', 'Oswald', 'Roboto'] as const

// Custom messages are translation keys; the UI translates them. zod translates its own messages.
const VALIDATION = {
  colour: 'validation.colour',
  minPoints: 'validation.minPoints',
  evenPoints: 'validation.evenPoints',
  uniqueIds: 'validation.uniqueIds',
  layerPath: 'validation.layerPath',
  base64: 'validation.base64',
  assetId: 'validation.assetId',
  missingAsset: 'validation.missingAsset'
} as const
export type ValidationKey = (typeof VALIDATION)[keyof typeof VALIDATION]
export const isValidationKey = (message: string): message is ValidationKey => (Object.values(VALIDATION) as string[]).includes(message)

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, VALIDATION.colour)
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
  transform: transformSchema
}

const assetIdSchema = z.string().regex(/^[0-9a-f]{64}$/, VALIDATION.assetId)

const fillSchema = z.object({ ...layerBase, color, kind: z.literal('fill') })
const rectSchema = z.object({
  ...layerBase,
  color,
  kind: z.literal('rect'),
  width: z.number().positive().max(100_000),
  height: z.number().positive().max(100_000),
  cornerRadius: z.number().min(0).max(100_000)
})
const polygonSchema = z.object({
  ...layerBase,
  color,
  kind: z.literal('polygon'),
  points: z
    .array(coordinate)
    .min(6, VALIDATION.minPoints)
    .max(20_000)
    .refine((p) => p.length % 2 === 0, VALIDATION.evenPoints)
})
const textSchema = z.object({
  ...layerBase,
  color,
  kind: z.literal('text'),
  text: z.string().max(1000),
  fontFamily: z.enum(FONTS),
  fontSize: z.number().positive().max(10_000),
  outline: z.object({ color, width: z.number().min(0).max(1000) }).nullable()
})

/** An imported image, shown at width × height template pixels before its transform. It has no colour. */
const imageSchema = z.object({
  ...layerBase,
  kind: z.literal('image'),
  assetId: assetIdSchema,
  width: z.number().positive().max(100_000),
  height: z.number().positive().max(100_000)
})

export const userLayerSchema = z.discriminatedUnion('kind', [fillSchema, rectSchema, polygonSchema, textSchema, imageSchema])

/** Base64 length of n bytes. */
const base64Length = (bytes: number) => Math.ceil(bytes / 3) * 4

/** Image bytes, keyed by the SHA-256 of the bytes: the same image used twice is stored once. */
export const assetSchema = z.object({
  type: z.enum(ASSET_TYPES),
  data: z
    .string()
    .max(base64Length(MAX_IMAGE_BYTES))
    .regex(/^[A-Za-z0-9+/]*={0,2}$/, VALIDATION.base64),
  width: z.number().int().min(1).max(MAX_IMAGE_PIXELS),
  height: z.number().int().min(1).max(MAX_IMAGE_PIXELS)
})

export const documentSchema = z.object({
  version: z.literal(2),
  templateId: z.string().min(1).max(500),
  insertion: z.number().int().min(0).max(10_000).nullable(),
  templateVisibility: z.record(z.string().regex(/^\d+(\/\d+)*$/, VALIDATION.layerPath), z.boolean()),
  layers: z
    .array(userLayerSchema)
    .max(MAX_LAYERS)
    .refine((layers) => new Set(layers.map((l) => l.id)).size === layers.length, VALIDATION.uniqueIds),
  assets: z.record(assetIdSchema, assetSchema)
}).superRefine((doc, context) => {
  doc.layers.forEach((layer, i) => {
    if (layer.kind === 'image' && !doc.assets[layer.assetId]) context.addIssue({ code: 'custom', path: ['layers', i, 'assetId'], message: VALIDATION.missingAsset })
  })
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
export type ImageLayer = z.infer<typeof imageSchema>
export type Asset = z.infer<typeof assetSchema>
export type UserLayer = z.infer<typeof userLayerSchema>
export type LayerKind = UserLayer['kind']
export type LiveryDocument = z.infer<typeof documentSchema>
export type ProjectFile = z.infer<typeof projectSchema>

/** Language-neutral errors: the UI translates them (`project.error.<code>`). Field messages come from zod. */
export type ProjectError =
  | { code: 'notJson' }
  | { code: 'notProject' }
  | { code: 'newerVersion'; version: number }
  | { code: 'templateMismatch' }
  | { code: 'field'; path: string; message: string }
  | { code: 'assetHash'; id: string }
  | { code: 'assetTooLarge'; id: string }

export type ParseResult = { ok: true; project: ProjectFile } | { ok: false; errors: ProjectError[] }

/** "layers.3.region" → "layers[3].region" */
const pathText = (path: PropertyKey[]) =>
  path.reduce<string>((text, key) => (typeof key === 'number' ? `${text}[${key}]` : text ? `${text}.${String(key)}` : String(key)), '')

/** For a bad record key, zod puts the useful message (ours) in a nested issue. */
const issueMessage = (issue: z.core.$ZodIssue): string =>
  issue.code === 'invalid_key' && issue.issues[0] ? issue.issues[0].message : issue.message

/** Reads a project file. Never trust it: it comes from outside the app. */
export function parseProject(text: string): ParseResult {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, errors: [{ code: 'notJson' }] }
  }
  const head = json as { format?: unknown; version?: unknown }
  if (typeof json !== 'object' || json === null || head.format !== PROJECT_FORMAT) {
    return { ok: false, errors: [{ code: 'notProject' }] }
  }
  if (typeof head.version === 'number' && head.version > PROJECT_VERSION) {
    return { ok: false, errors: [{ code: 'newerVersion', version: head.version }] }
  }
  migrate(json as Record<string, unknown>)
  const result = projectSchema.safeParse(json)
  if (!result.success) {
    return { ok: false, errors: result.error.issues.map((issue) => ({ code: 'field', path: pathText(issue.path) || 'file', message: issueMessage(issue) })) }
  }
  if (result.data.document.templateId !== result.data.template.id) {
    return { ok: false, errors: [{ code: 'templateMismatch' }] }
  }
  return { ok: true, project: result.data }
}

/**
 * Brings an older file to the current format, in place. The schema checks the result, so this code only
 * changes what it recognises. Version 1 → 2: the document gets an empty `assets` table (no images then).
 */
function migrate(json: Record<string, unknown>): void {
  if (json.version !== 1) return
  json.version = 2
  const document = json.document as Record<string, unknown> | null
  if (typeof document === 'object' && document !== null && document.version === 1) {
    document.version = 2
    document.assets ??= {}
  }
}

/** Hex SHA-256 of bytes (WebCrypto: the renderer and Node.js both have it). */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(binary)
}

/** Second step of the validation, after parseProject: each asset's bytes match its ID and its size limit. */
export async function verifyAssets(document: LiveryDocument): Promise<ProjectError[]> {
  const errors: ProjectError[] = []
  for (const [id, asset] of Object.entries(document.assets)) {
    const bytes = base64ToBytes(asset.data)
    if (bytes.length > MAX_IMAGE_BYTES) errors.push({ code: 'assetTooLarge', id })
    else if ((await sha256Hex(bytes)) !== id) errors.push({ code: 'assetHash', id })
  }
  return errors
}

/** Assets that no layer uses (an image layer was deleted) are not saved. */
function withoutUnusedAssets(document: LiveryDocument): LiveryDocument {
  const used = new Set(document.layers.flatMap((l) => (l.kind === 'image' ? [l.assetId] : [])))
  const assets = Object.fromEntries(Object.entries(document.assets).filter(([id]) => used.has(id)))
  return { ...document, assets }
}

export function serializeProject(document: LiveryDocument, templateSizeBytes: number, now = new Date()): string {
  const project: ProjectFile = {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    savedAt: now.toISOString(),
    template: { id: document.templateId, sizeBytes: templateSizeBytes },
    document: withoutUnusedAssets(document)
  }
  return JSON.stringify(project, null, 2)
}
