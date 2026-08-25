import './styles.css'

export { default as LanguageSwitcher, DEFAULT_LANGUAGES } from './LanguageSwitcher'
export type { LanguageOption, LanguageSwitcherProps } from './LanguageSwitcher'
export {
  applyGoogleTranslateLanguage,
  ensureGoogleTranslate,
  findGoogleTranslateCombo,
  GOOGLE_TRANSLATE_DEFAULTS,
  readGoogleTranslateLanguage,
  writeGoogleTranslateLanguage,
} from './googleTranslate'
export type { GoogleTranslateOptions } from './googleTranslate'
