import type { TemplateOutline, Visibility } from '../../../shared/psd/templateRender'

// Messages between the editor and the template worker.

export type WorkerRequest =
  | { type: 'load'; url: string }
  | { type: 'segments'; requestId: number; insertion: number; visibility: Visibility }
  | { type: 'exact'; requestId: number; insertion: number; visibility: Visibility; user: ImageBitmap }
  | { type: 'export'; insertion: number; visibility: Visibility; user: ImageBitmap; userRegions: ImageBitmap }

export type LoadStage = 'reading' | 'parsing' | 'guides' | 'segments' | 'export-skin' | 'export-regions'

export type WorkerResponse =
  | { type: 'progress'; stage: LoadStage; fraction: number | null }
  | { type: 'outline'; outline: TemplateOutline }
  | { type: 'guides'; wireframe: ImageBitmap | null; mask: ImageBitmap | null; regions: ImageBitmap; ms: number }
  | {
      type: 'segments'
      requestId: number
      below: ImageBitmap
      above: ImageBitmap
      table: Uint8Array
      fastIsExact: boolean
      unsupported: Record<string, number>
      ms: number
    }
  | { type: 'exact'; requestId: number; image: ImageBitmap; ms: number }
  | { type: 'exported'; skin: ArrayBuffer; region: ArrayBuffer; ms: number }
  | { type: 'error'; message: string }
