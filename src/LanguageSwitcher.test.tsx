// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import LanguageSwitcher from './LanguageSwitcher'

describe('LanguageSwitcher', () => {
  it('renders an isolated accessible Google Translate enabler', () => {
    const markup = renderToStaticMarkup(
      <LanguageSwitcher
        loadGoogleTranslate={false}
        translateTargetId="apogeo-google-translate"
      />,
    )

    expect(markup).toContain('aria-haspopup="listbox"')
    expect(markup).toContain('aria-controls="')
    expect(markup).toContain('ls-google-translate-target')
    expect(markup).toContain('apogeo-google-translate')
    expect(markup).toContain('aria-expanded="false"')
    expect(markup).not.toMatch(/post|filter|navigate|URLSearchParams/i)
  })
})
