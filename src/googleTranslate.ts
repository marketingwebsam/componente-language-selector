export interface GoogleTranslateOptions {
  targetId: string
  pageLanguage?: string
  includedLanguages?: string
  scriptUrl?: string
  timeoutMs?: number
}

type TranslateElementConstructor = new (
  options: {
    pageLanguage: string
    includedLanguages: string
    autoDisplay: boolean
  },
  targetId: string,
) => unknown

interface GoogleTranslateWindow extends Window {
  google?: {
    translate?: {
      TranslateElement?: TranslateElementConstructor & {
        InlineLayout?: { SIMPLE?: unknown }
      }
    }
  }
  componentLanguageSwitcherGoogleTranslateInit?: () => void
}

const DEFAULT_SCRIPT_URL = 'https://translate.google.com/translate_a/element.js'
const DEFAULT_PAGE_LANGUAGE = 'pt'
const DEFAULT_INCLUDED_LANGUAGES = 'en,es,it,pt,pt-PT,zh-CN,ja,fr'
const CALLBACK_NAME = 'componentLanguageSwitcherGoogleTranslateInit'
const SCRIPT_ATTRIBUTE = 'data-component-language-switcher-google-translate'
const COOKIE_NAME = 'googtrans'

function getWindow(): GoogleTranslateWindow | null {
  return typeof window === 'undefined' ? null : (window as GoogleTranslateWindow)
}

function getTranslateConstructor(): TranslateElementConstructor | null {
  const currentWindow = getWindow()
  const constructor = currentWindow?.google?.translate?.TranslateElement
  return typeof constructor === 'function' ? constructor : null
}

function getTarget(targetId: string): HTMLElement | null {
  if (typeof document === 'undefined') return null
  return document.getElementById(targetId)
}

/**
 * Reads the language selected by Google's own `googtrans` cookie.
 * This is intentionally the only persisted language state used by the adapter.
 */
export function readGoogleTranslateLanguage(defaultLanguage = DEFAULT_PAGE_LANGUAGE): string {
  if (typeof document === 'undefined') return defaultLanguage

  try {
    const match = document.cookie.match(/(?:^|;\s*)googtrans=([^;]+)/)
    if (!match?.[1]) return defaultLanguage
    const value = decodeURIComponent(match[1])
    const language = value.match(/^\/[^/]+\/([^/]+)$/)?.[1]
    return language || defaultLanguage
  } catch {
    return defaultLanguage
  }
}

/**
 * Writes Google's standard translation cookie at the site root.
 * No query parameter, pathname, post identifier or content state is changed.
 */
export function writeGoogleTranslateLanguage(language: string): void {
  if (typeof document === 'undefined') return

  try {
    const value = `/auto/${language}`
    const expires = 'expires=Thu, 31 Dec 2099 23:59:59 UTC;path=/;SameSite=Lax'
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)};${expires}`
  } catch {
    // SafeWidget: cookie restrictions must never break the page.
  }
}

export function findGoogleTranslateCombo(targetId: string): HTMLSelectElement | null {
  const target = getTarget(targetId)
  return target?.querySelector<HTMLSelectElement>('.goog-te-combo') || null
}

/**
 * Applies a language through Google's native select element.
 * The lookup is scoped to this component's hidden target to avoid touching
 * arbitrary selects from the host application, including post filters.
 */
export function applyGoogleTranslateLanguage(language: string, targetId: string): boolean {
  const combo = findGoogleTranslateCombo(targetId)
  if (!combo) return false

  try {
    combo.value = language
    combo.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  } catch {
    return false
  }
}

function initializeGoogleTranslate(options: Required<Pick<GoogleTranslateOptions, 'targetId' | 'pageLanguage' | 'includedLanguages'>>): boolean {
  const constructor = getTranslateConstructor()
  const target = getTarget(options.targetId)
  if (!constructor || !target) return false
  if (target.querySelector('.goog-te-combo')) return true

  try {
    new constructor(
      {
        pageLanguage: options.pageLanguage,
        includedLanguages: options.includedLanguages,
        autoDisplay: false,
      },
      options.targetId,
    )
    return true
  } catch {
    return false
  }
}

function getOrCreateScript(scriptUrl: string): HTMLScriptElement | null {
  if (typeof document === 'undefined') return null

  const existing = document.querySelector<HTMLScriptElement>(
    `script[${SCRIPT_ATTRIBUTE}], script[src*="translate.google.com/translate_a/element.js"]`,
  )
  if (existing) return existing

  try {
    const script = document.createElement('script')
    script.async = true
    script.src = `${scriptUrl}${scriptUrl.includes('?') ? '&' : '?'}cb=${CALLBACK_NAME}`
    script.setAttribute(SCRIPT_ATTRIBUTE, 'true')
    document.head.appendChild(script)
    return script
  } catch {
    return null
  }
}

/**
 * Ensures Google's widget exists inside this component's target.
 * Existing host scripts are reused; a second Google script is never inserted.
 */
export function ensureGoogleTranslate(options: GoogleTranslateOptions): Promise<boolean> {
  const normalized = {
    targetId: options.targetId,
    pageLanguage: options.pageLanguage || DEFAULT_PAGE_LANGUAGE,
    includedLanguages: options.includedLanguages || DEFAULT_INCLUDED_LANGUAGES,
    scriptUrl: options.scriptUrl || DEFAULT_SCRIPT_URL,
    timeoutMs: options.timeoutMs || 10000,
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(false)
  }

  if (initializeGoogleTranslate(normalized)) return Promise.resolve(true)

  const currentWindow = getWindow()
  const previousCallback = currentWindow?.[CALLBACK_NAME]
  if (currentWindow) {
    currentWindow[CALLBACK_NAME] = () => {
      if (typeof previousCallback === 'function') previousCallback()
      initializeGoogleTranslate(normalized)
    }
  }
  getOrCreateScript(normalized.scriptUrl)

  return new Promise((resolve) => {
    const startedAt = Date.now()
    const poll = () => {
      const initialized = initializeGoogleTranslate(normalized)
      if (initialized || Date.now() - startedAt >= normalized.timeoutMs) {
        resolve(initialized)
        return
      }
      window.setTimeout(poll, 50)
    }
    poll()
  })
}

export const GOOGLE_TRANSLATE_DEFAULTS = {
  pageLanguage: DEFAULT_PAGE_LANGUAGE,
  includedLanguages: DEFAULT_INCLUDED_LANGUAGES,
  scriptUrl: DEFAULT_SCRIPT_URL,
} as const
