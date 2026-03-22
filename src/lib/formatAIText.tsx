import React from 'react'

interface FormatOptions {
  baseFontSize?: string
  headingFontSize?: string
  textColor?: string
  headingColor?: string
}

/** Strips inline markdown markers (**, ***, *) and renders bold spans */
function renderInline(text: string, accentColor = 'var(--sand-900)'): React.ReactNode[] {
  // Normalize ***text*** → **text** so triple-asterisk bold+italic collapses to bold
  const normalized = text.replace(/\*{3}([^*]+)\*{3}/g, '**$1**')
  // Split on ** pairs
  const parts = normalized.split(/\*\*/)
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={i} style={{ fontWeight: '600', color: accentColor }}>{part}</strong>
      : part.replace(/\*/g, '') // strip any stray single asterisks
  )
}

/**
 * Renders AI-generated markdown-lite text into styled React elements.
 * Handles:
 *   - Lines starting with #, ##, ### → section header (hashes stripped)
 *   - Lines entirely wrapped in **...** → section header
 *   - Lines that are ALL CAPS (or ALL CAPS + colon) → section header
 *   - Lines starting with "- " → bullet
 *   - Lines starting with "1. " → numbered item
 *   - Empty lines → spacer
 *   - Everything else → paragraph with inline bold parsing
 */
export function formatAIText(
  text: string,
  opts: FormatOptions = {}
): React.ReactNode[] {
  const {
    baseFontSize = '13px',
    textColor = 'var(--sand-800)',
  } = opts

  const lines = text.split('\n')

  const renderSectionHeader = (content: string, key: number) => (
    <div key={key} style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      margin: '16px 0 6px',
    }}>
      <div style={{
        width: '3px',
        height: '14px',
        background: 'var(--accent)',
        borderRadius: '2px',
        flexShrink: 0,
      }} />
      <p style={{
        fontSize: '11px',
        fontWeight: '700',
        color: 'var(--accent)',
        margin: 0,
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
      }}>{content}</p>
    </div>
  )

  return lines.map((line, i) => {
    const trimmed = line.trim()

    // Empty line → spacer
    if (!trimmed) {
      return <div key={i} style={{ height: '8px' }} />
    }

    // ### / ## / # heading → section header (strip hashes and asterisks)
    const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/)
    if (headingMatch) {
      const content = headingMatch[1].replace(/\*{1,3}/g, '').trim()
      return renderSectionHeader(content, i)
    }

    // Entire line wrapped in **...** → section header
    if (/^\*\*[^*]+\*\*$/.test(trimmed)) {
      const content = trimmed.slice(2, -2)
      return renderSectionHeader(content, i)
    }

    // ALL CAPS lines (possibly ending with colon) → section divider
    const isAllCaps = /^[A-Z0-9 :$%().,/\-–]{10,}$/.test(trimmed) && /[A-Z]{3,}/.test(trimmed)
    const isLongAllCaps = isAllCaps && (trimmed.endsWith(':') || trimmed.length >= 20)
    if (isLongAllCaps) {
      return renderSectionHeader(trimmed.replace(/:$/, ''), i)
    }

    // Numbered list item
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/)
    if (numMatch) {
      return (
        <div key={i} style={{ display: 'flex', gap: '10px', marginTop: '6px', alignItems: 'flex-start' }}>
          <div style={{
            width: '20px',
            height: '20px',
            background: 'var(--accent)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: '1px',
          }}>
            <span style={{ color: 'var(--sand-50)', fontSize: '10px', fontWeight: '700' }}>{numMatch[1]}</span>
          </div>
          <span style={{ fontSize: baseFontSize, lineHeight: '1.6', color: textColor }}>
            {renderInline(numMatch[2])}
          </span>
        </div>
      )
    }

    // Bullet list item
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      return (
        <div key={i} style={{ display: 'flex', gap: '8px', marginTop: '5px', alignItems: 'flex-start' }}>
          <span style={{
            color: 'var(--accent)',
            fontWeight: '700',
            flexShrink: 0,
            fontSize: '16px',
            lineHeight: '1.3',
          }}>·</span>
          <span style={{ fontSize: baseFontSize, lineHeight: '1.6', color: textColor }}>
            {renderInline(trimmed.slice(2))}
          </span>
        </div>
      )
    }

    // Regular paragraph — parse inline bold
    return (
      <p key={i} style={{ fontSize: baseFontSize, lineHeight: '1.65', margin: '3px 0', color: textColor }}>
        {renderInline(trimmed)}
      </p>
    )
  })
}
