// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyGoogleTranslateLanguage,
  ensureGoogleTranslate,
  findGoogleTranslateCombo,
  readGoogleTranslateLanguage,
  writeGoogleTranslateLanguage,
} from './googleTranslate'

afterEach(() => {
  document.body.innerHTML = ''
  document.head.innerHTML = ''
  document.cookie = 'googtrans=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/'
  delete (window as Window & { google?: unknown }).google
  delete (window as Window & { componentLanguageSwitcherGoogleTranslateInit?: unknown }).componentLanguageSwitcherGoogleTranslateInit
  vi.restoreAllMocks()
})

describe('Google Translate adapter', () => {
  it('uses only the googtrans cookie for the selected language', () => {
    writeGoogleTranslateLanguage('es')
    expect(document.cookie).toContain('googtrans=%2Fauto%2Fes')
    expect(readGoogleTranslateLanguage()).toBe('es')
  })

  it('scopes the native combo lookup to the component target', () => {
    document.body.innerHTML = `
      <div id="other-widget"><select class="goog-te-combo"><option value="en">English</option></select></div>
      <div id="language-target"><select class="goog-te-combo"><option value="pt">Português</option><option value="fr">Français</option></select></div>
    `

    const targetCombo = findGoogleTranslateCombo('language-target')
    expect(targetCombo).not.toBeNull()
    expect(findGoogleTranslateCombo('missing-target')).toBeNull()

    const otherCombo = document.querySelector('#other-widget .goog-te-combo') as HTMLSelectElement
    const otherChange = vi.fn()
    otherCombo.addEventListener('change', otherChange)

    expect(applyGoogleTranslateLanguage('fr', 'language-target')).toBe(true)
    expect(targetCombo?.value).toBe('fr')
    expect(otherChange).not.toHaveBeenCalled()
  })

  it('dispatches a native change event and never writes post or route state', () => {
    document.body.innerHTML = `
      <div id="language-target">
        <select class="goog-te-combo"><option value="pt">Português</option><option value="en">English</option></select>
      </div>
    `
    const combo = document.querySelector('#language-target .goog-te-combo') as HTMLSelectElement
    const change = vi.fn()
    combo.addEventListener('change', change)
    expect(applyGoogleTranslateLanguage('en', 'language-target')).toBe(true)
    expect(change).toHaveBeenCalledTimes(1)
    expect(window.location.pathname).toBe('/')
    expect(window.location.search).toBe('')
  })

  it('reuses a host Google Translate script and initializes the scoped target', async () => {
    document.body.innerHTML = '<div id="language-target"></div>'
    const TranslateElement = vi.fn(function (this: unknown, _options: unknown, targetId: string) {
      const target = document.getElementById(targetId)
      target?.insertAdjacentHTML('beforeend', '<select class="goog-te-combo"><option value="pt">Português</option></select>')
    }) as unknown as new (...args: unknown[]) => unknown

    ;(window as Window & { google?: unknown }).google = {
      translate: { TranslateElement },
    }

    const initialized = await ensureGoogleTranslate({ targetId: 'language-target' })
    expect(initialized).toBe(true)
    expect(TranslateElement).toHaveBeenCalledTimes(1)
    expect(document.querySelectorAll('script[data-component-language-switcher-google-translate]').length).toBe(0)
    expect(findGoogleTranslateCombo('language-target')).not.toBeNull()
  })
})
