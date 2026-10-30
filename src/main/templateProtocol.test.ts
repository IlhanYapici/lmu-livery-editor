import { describe, expect, it } from 'vitest'
import { templateUrl, type Catalogue } from '../shared/api'
import { resolveTemplateUrl } from './templateProtocol'

const catalogue: Catalogue = [
  {
    id: 'GT3',
    name: 'LMGT3',
    shortName: 'GT3',
    cars: [
      {
        id: 'GT3:McLaren720EVO',
        name: 'McLaren 720S EVO',
        variants: [{ id: 'Template_GT3_McLaren720EVO_2025 _ELMS.psd', label: '2025 ELMS', path: 'E:\\T\\Template_GT3_McLaren720EVO_2025 _ELMS.psd', sizeBytes: 1 }]
      }
    ]
  }
]

describe('resolveTemplateUrl', () => {
  it('resolves a catalogue file name, also with spaces', () => {
    expect(resolveTemplateUrl(templateUrl('Template_GT3_McLaren720EVO_2025 _ELMS.psd'), catalogue)).toBe(
      'E:\\T\\Template_GT3_McLaren720EVO_2025 _ELMS.psd'
    )
  })

  it('refuses names outside the catalogue, path tricks and other hosts or schemes', () => {
    for (const url of [
      templateUrl('Template_GT3_Other.psd'),
      templateUrl('../../../Windows/win.ini'),
      'lmu-template://template/..%2F..%2Fsecret.txt',
      'lmu-template://other/Template_GT3_McLaren720EVO_2025%20_ELMS.psd',
      'file:///E:/T/Template_GT3_McLaren720EVO_2025%20_ELMS.psd',
      'not a url'
    ]) {
      expect(resolveTemplateUrl(url, catalogue)).toBeNull()
    }
  })
})
