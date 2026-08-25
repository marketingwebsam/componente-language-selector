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
    includedLanguages?: string
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
  gt_translate_script?: HTMLScriptElement
}

const DEFAULT_SCRIPT_URL = 'https://translate.google.com/translate_a/element.js'
const DEFAULT_PAGE_LANGUAGE = 'pt'
// Empty by default: Google must load its complete native catalog. Consumers may
// still pass `includedLanguages` explicitly when they knowingly need a subset.
const DEFAULT_INCLUDED_LANGUAGES = ''
const CALLBACK_NAME = 'componentLanguageSwitcherGoogleTranslateInit'
const SCRIPT_ATTRIBUTE = 'data-component-language-switcher-google-translate'
const INITIALIZATION_ATTRIBUTE = 'data-component-language-switcher-google-translate-initialization'
const INITIALIZATION_STARTED_ATTRIBUTE = `${INITIALIZATION_ATTRIBUTE}-at`
const INITIALIZATION_STALE_MS = 1000
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

function clearInitializationMarker(target: HTMLElement): void {
  target.removeAttribute(INITIALIZATION_ATTRIBUTE)
  target.removeAttribute(INITIALIZATION_STARTED_ATTRIBUTE)
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

export function clearGoogleTranslateLanguage(): void {
  if (typeof document === 'undefined') return

  try {
    document.cookie = `${COOKIE_NAME}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
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
  if (!combo || combo.options.length === 0) return false

  try {
    combo.value = language
    // GTranslate's widget fires the native event twice for compatibility
    // across browsers and versions of the Website Translator runtime.
    combo.dispatchEvent(new Event('change', { bubbles: true }))
    combo.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  } catch {
    return false
  }
}

function initializeGoogleTranslate(options: {
  targetId: string
  pageLanguage: string
  includedLanguages?: string
}): boolean {
  const constructor = getTranslateConstructor()
  const target = getTarget(options.targetId)
  if (!constructor || !target) return false

  const combo = target.querySelector<HTMLSelectElement>('.goog-te-combo')
  if (combo && combo.options.length > 0) {
    clearInitializationMarker(target)
    return true
  }

  if (target.getAttribute(INITIALIZATION_ATTRIBUTE) === 'pending') {
    const startedAt = Number(target.getAttribute(INITIALIZATION_STARTED_ATTRIBUTE))
    const isRecent = Number.isFinite(startedAt) && Date.now() - startedAt < INITIALIZATION_STALE_MS
    if (isRecent) return false
    // A host callback may have created an empty widget before this adapter was
    // mounted. Let the adapter recover instead of remaining stuck forever.
    clearInitializationMarker(target)
  }

  target.setAttribute(INITIALIZATION_ATTRIBUTE, 'pending')
  target.setAttribute(INITIALIZATION_STARTED_ATTRIBUTE, String(Date.now()))
  try {
    const translateOptions: {
      pageLanguage: string
      includedLanguages?: string
      autoDisplay: boolean
    } = {
      pageLanguage: options.pageLanguage,
      autoDisplay: false,
    }
    if (options.includedLanguages) translateOptions.includedLanguages = options.includedLanguages

    new constructor(translateOptions, options.targetId)
    const initializedCombo = target.querySelector<HTMLSelectElement>('.goog-te-combo')
    const initialized = Boolean(initializedCombo && initializedCombo.options.length > 0)
    if (initialized) clearInitializationMarker(target)
    return initialized
  } catch {
    clearInitializationMarker(target)
    return false
  }
}

function getOrCreateScript(scriptUrl: string): HTMLScriptElement | null {
  if (typeof document === 'undefined') return null

  const currentWindow = getWindow()
  const trackedScript = currentWindow?.gt_translate_script
  if (trackedScript) return trackedScript

  const existing = document.querySelector<HTMLScriptElement>(
    `script[${SCRIPT_ATTRIBUTE}], script[src*="translate.google.com/translate_a/element.js"]`,
  )
  if (existing) {
    if (currentWindow) currentWindow.gt_translate_script = existing
    return existing
  }

  try {
    const script = document.createElement('script')
    // GTranslate 3.1.1 appends this script without async. Keep the same
    // ordered bootstrap so the callback is installed before script execution.
    script.async = false
    script.src = `${scriptUrl}${scriptUrl.includes('?') ? '&' : '?'}cb=${CALLBACK_NAME}`
    script.setAttribute(SCRIPT_ATTRIBUTE, 'true')
    ;(document.body || document.head).appendChild(script)
    if (currentWindow) currentWindow.gt_translate_script = script
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

  const existingCombo = findGoogleTranslateCombo(normalized.targetId)
  if (existingCombo && existingCombo.options.length > 0) return Promise.resolve(true)

  const currentWindow = getWindow()
  const previousCallback = currentWindow?.[CALLBACK_NAME]
  if (currentWindow) {
    currentWindow[CALLBACK_NAME] = () => {
      if (typeof previousCallback === 'function') previousCallback()
      initializeGoogleTranslate(normalized)
    }
  }

  getOrCreateScript(normalized.scriptUrl)
  initializeGoogleTranslate(normalized)

  return new Promise((resolve) => {
    const startedAt = Date.now()
    const poll = () => {
      const combo = findGoogleTranslateCombo(normalized.targetId)
      if (combo && combo.options.length > 0) {
        resolve(true)
        return
      }
      if (Date.now() - startedAt >= normalized.timeoutMs) {
        const target = getTarget(normalized.targetId)
        if (target) clearInitializationMarker(target)
        resolve(false)
        return
      }
      // A host script may finish loading after the first call. Re-enter the
      // initializer on every poll; the pending guard prevents duplicate
      // constructors while still allowing a late Google API to bootstrap.
      initializeGoogleTranslate(normalized)
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
