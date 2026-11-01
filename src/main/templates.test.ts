import { describe, expect, it } from 'vitest'
import { buildCatalogue, parseTemplateName } from './templates'

// The 60 file names of support\LiveryTemplates on a real install (October 2026).
const REAL_NAMES = [
  'Template_GT3_AstonMartinVantage.psd',
  'Template_GT3_AstonMartinVantage_2025.psd',
  'Template_GT3_AstonMartinVantage_2025_ELMS.psd',
  'Template_GT3_BMWM4LMGT3.psd',
  'Template_GT3_BMWM4LMGT3_2025.psd',
  'Template_GT3_CorvetteZ06LMGT3.psd',
  'Template_GT3_CorvetteZ06LMGT3_2025.psd',
  'Template_GT3_CorvetteZ06LMGT3_2025_ELMS.psd',
  'Template_GT3_Ferrari296LMGT3.psd',
  'Template_GT3_Ferrari296LMGT3_2025.psd',
  'Template_GT3_Ferrari296LMGT3_2025_ELMS.psd',
  'Template_GT3_Ferrari296LMGT3_EVO_2026.psd',
  'Template_GT3_FordMustangLMGT3.psd',
  'Template_GT3_FordMustangLMGT3_2025.psd',
  'Template_GT3_FordMustang_EVO_LMGT3.psd',
  'Template_GT3_LamborghiniHuracan.psd',
  'Template_GT3_LexusRCF.psd',
  'Template_GT3_LexusRCF_2025.psd',
  'Template_GT3_McLaren720EVO.psd',
  'Template_GT3_McLaren720EVO_2025 _ELMS.psd',
  'Template_GT3_McLaren720EVO_2025.psd',
  'Template_GT3_MercedesAMG_2025.psd',
  'Template_GT3_MercedesAMG_2025_ELMS.psd',
  'Template_GT3_Porsche911LMGT3R.psd',
  'Template_GT3_Porsche911LMGT3R_2025.psd',
  'Template_GT3_Porsche911LMGT3R_2025_ELMS.psd',
  'Template_GT3_Porsche911LMGT3R_2026.psd',
  'Template_GTE_AstonMartinVantage.psd',
  'Template_GTE_CorvetteC8R.psd',
  'Template_GTE_Ferrari488.psd',
  'Template_GTE_PorscheRSR.psd',
  'Template_HYPER_AlpineA424.psd',
  'Template_HYPER_AlpineA424_2026.psd',
  'Template_HYPER_AstonMartinValkyrie.psd',
  'Template_HYPER_BMWMHybrid.psd',
  'Template_HYPER_BMWMHybrid_EVO.psd',
  'Template_HYPER_CadillacVSeries.psd',
  'Template_HYPER_CadillacVSeries_EVO_2026.psd',
  'Template_HYPER_Ferrari499P.psd',
  'Template_HYPER_Ferrari499P_2025.psd',
  'Template_HYPER_GenesisGMR001.psd',
  'Template_HYPER_GlickenhausSCG007.psd',
  'Template_HYPER_IsottaFraschiniTipo6.psd',
  'Template_HYPER_LamborghiniSC63.psd',
  'Template_HYPER_Peugeot9x8_2023.psd',
  'Template_HYPER_Peugeot9x8_2024.psd',
  'Template_HYPER_Peugeot9x8_2026.psd',
  'Template_HYPER_Porsche963.psd',
  'Template_HYPER_Porsche963_2025.psd',
  'Template_HYPER_ToyotaGR010.psd',
  'Template_HYPER_ToyotaGR010_2025.psd',
  'Template_HYPER_ToyotaTR010_2026.psd',
  'Template_HYPER_Vanwall680.psd',
  'Template_LMP2_Oreca07.psd',
  'Template_LMP2_Oreca07_2025.psd',
  'Template_LMP2_Oreca07_ELMS_2025.psd',
  'Template_LMP3_ADESS_AD25.psd',
  'Template_LMP3_Duqueine_D09.psd',
  'Template_LMP3_Ginetta_G61Evo.psd',
  'Template_LMP3_Ligier_JSP325.psd'
]

const catalogueOf = (names: string[]) => buildCatalogue(names.map((name) => ({ name, path: `X:\\LiveryTemplates\\${name}`, sizeBytes: 1 })))

/** Compact view: { category: { car: [variant labels] } }. */
const summary = (names: string[]) =>
  Object.fromEntries(
    catalogueOf(names).map((cat) => [cat.name, Object.fromEntries(cat.cars.map((car) => [car.name, car.variants.map((v) => v.label)]))])
  )

describe('parseTemplateName', () => {
  it('finds variant tokens at any position', () => {
    expect(parseTemplateName('Template_GT3_FordMustang_EVO_LMGT3.psd')).toMatchObject({
      classCode: 'GT3',
      carKey: 'FordMustangLMGT3',
      evo: true
    })
    expect(parseTemplateName('Template_LMP2_Oreca07_ELMS_2025.psd')).toMatchObject({
      carKey: 'Oreca07',
      year: 2025,
      elms: true
    })
  })

  it('ignores spaces around separators', () => {
    expect(parseTemplateName('Template_GT3_McLaren720EVO_2025 _ELMS.psd')).toMatchObject({
      carKey: 'McLaren720EVO',
      year: 2025,
      elms: true
    })
  })

  it('keeps EVO when it is part of a car token', () => {
    expect(parseTemplateName('Template_LMP3_Ginetta_G61Evo.psd')).toMatchObject({ carKey: 'GinettaG61Evo', evo: false })
  })

  it('maps the renamed Toyota to the same car', () => {
    expect(parseTemplateName('Template_HYPER_ToyotaTR010_2026.psd')).toMatchObject({
      carKey: 'ToyotaGR010',
      note: 'TR010'
    })
  })

  it('rejects names without the Template_<CLASS>_<car> form', () => {
    expect(parseTemplateName('readme.psd')).toBeNull()
    expect(parseTemplateName('Template_GT3.psd')).toBeNull()
    expect(parseTemplateName('Template_GT3_2025.psd')).toBeNull()
  })
})

describe('buildCatalogue', () => {
  it('builds the full tree from the real file names', () => {
    expect(summary(REAL_NAMES)).toEqual({
      Hypercar: {
        'Alpine A424': ['Base', '2026'],
        'Aston Martin Valkyrie': ['Base'],
        'BMW M Hybrid V8': ['Base', 'EVO'],
        'Cadillac V-Series.R': ['Base', 'EVO 2026'],
        'Ferrari 499P': ['Base', '2025'],
        'Genesis GMR-001': ['Base'],
        'Glickenhaus SCG 007': ['Base'],
        'Isotta Fraschini Tipo 6': ['Base'],
        'Lamborghini SC63': ['Base'],
        'Peugeot 9X8': ['2023', '2024', '2026'],
        'Porsche 963': ['Base', '2025'],
        'Toyota GR010 / TR010': ['Base', '2025', '2026 TR010'],
        'Vanwall Vandervell 680': ['Base']
      },
      LMP2: { 'Oreca 07': ['Base', '2025', '2025 ELMS'] },
      LMP3: {
        'ADESS AD25': ['Base'],
        'Duqueine D09': ['Base'],
        'Ginetta G61 Evo': ['Base'],
        'Ligier JS P325': ['Base']
      },
      LMGT3: {
        'Aston Martin Vantage': ['Base', '2025', '2025 ELMS'],
        'BMW M4 LMGT3': ['Base', '2025'],
        'Corvette Z06 LMGT3': ['Base', '2025', '2025 ELMS'],
        'Ferrari 296 LMGT3': ['Base', '2025', '2025 ELMS', 'EVO 2026'],
        'Ford Mustang LMGT3': ['Base', '2025', 'EVO'],
        'Lamborghini Huracán': ['Base'],
        'Lexus RC F': ['Base', '2025'],
        'McLaren 720S EVO': ['Base', '2025', '2025 ELMS'],
        'Mercedes-AMG': ['2025', '2025 ELMS'],
        'Porsche 911 LMGT3 R': ['Base', '2025', '2025 ELMS', '2026']
      },
      LMGTE: {
        'Aston Martin Vantage': ['Base'],
        'Corvette C8.R': ['Base'],
        'Ferrari 488 GTE': ['Base'],
        'Porsche 911 RSR': ['Base']
      }
    })
  })

  it('keeps every file and gives each variant a unique label within its car', () => {
    const catalogue = catalogueOf(REAL_NAMES)
    const variants = catalogue.flatMap((cat) => cat.cars.flatMap((car) => car.variants))
    expect(variants).toHaveLength(REAL_NAMES.length)
    for (const car of catalogue.flatMap((cat) => cat.cars)) {
      const labels = car.variants.map((v) => v.label)
      expect(new Set(labels).size).toBe(labels.length)
    }
  })

  it('gives each category the long and short class names of the game', () => {
    expect(catalogueOf(REAL_NAMES).map((c) => `${c.name}/${c.shortName}`)).toEqual([
      'Hypercar/HY',
      'LMP2/P2',
      'LMP3/P3',
      'LMGT3/GT3',
      'LMGTE/GTE'
    ])
  })

  it('puts unknown classes and unparsable names under "Other"', () => {
    expect(summary(['Template_WEC_NewCar.psd', 'odd.psd'])).toEqual({
      Other: { NewCar: ['Base'], odd: ['odd.psd'] }
    })
  })
})
