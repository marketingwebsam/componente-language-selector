// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LanguageSwitcher from './LanguageSwitcher'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(() => {
  if (root) {
    act(() => root?.unmount())
  }
  root = null
  container?.remove()
  container = null
  document.body.innerHTML = ''
  document.cookie = 'googtrans=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/'
})

describe('LanguageSwitcher', () => {
  it('renders an isolated accessible Google Translate enabler', () => {
    const markup = renderMarkup()

    expect(markup).toContain('aria-haspopup="listbox"')
    expect(markup).toContain('aria-controls="')
    expect(markup).toContain('ls-google-translate-target')
    expect(markup).toContain('apogeo-google-translate')
    expect(markup).toContain('aria-expanded="false"')
    expect(markup).not.toMatch(/post|filter|navigate|URLSearchParams/i)
  })

  it('changes only the Google combo when a user selects a language', () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    act(() => {
      root?.render(
        <LanguageSwitcher
          loadGoogleTranslate={false}
          translateTargetId="test-google-target"
        />,
      )
    })

    const target = document.getElementById('test-google-target')
    expect(target).not.toBeNull()
    target?.insertAdjacentHTML(
      'beforeend',
      '<select class="goog-te-combo"><option value="pt">Português</option><option value="en">English</option></select>',
    )
    const combo = target?.querySelector<HTMLSelectElement>('.goog-te-combo')
    const change = vi.fn()
    combo?.addEventListener('change', change)

    const trigger = container.querySelector<HTMLButtonElement>('.ls-trigger')
    expect(trigger).not.toBeNull()
    act(() => trigger?.click())
    const option = Array.from(container.querySelectorAll<HTMLButtonElement>('.ls-option'))
      .find((button) => button.textContent?.includes('English'))
    expect(option).not.toBeUndefined()

    act(() => option?.click())

    expect(combo?.value).toBe('en')
    expect(change).toHaveBeenCalledTimes(2)
    expect(window.location.pathname).toBe('/')
    expect(window.location.search).toBe('')
    expect(document.cookie).toContain('googtrans=%2Fauto%2Fen')
  })
})

function renderMarkup() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)

  act(() => {
    root?.render(
      <LanguageSwitcher
        loadGoogleTranslate={false}
        translateTargetId="apogeo-google-translate"
      />,
    )
  })

  return container.innerHTML
}
