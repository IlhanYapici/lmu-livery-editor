import type en from './en.json'

// Typed translation keys: a wrong key or a missing variable is a type error.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: typeof en }
  }
}
