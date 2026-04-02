/**
 * Streams a chat response from /api/chat, calling onChunk as each text delta arrives.
 * Returns the full accumulated response text.
 */
export async function streamChat(
  body: object,
  onChunk: (fullText: string) => void
): Promise<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, stream: true })
  })

  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error || 'Chat request failed')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let fullText = ''
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    // Keep the last (potentially incomplete) line in the buffer
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') return fullText
      try {
        const parsed = JSON.parse(data)
        if (parsed.error) throw new Error(parsed.error)
        if (parsed.text) {
          fullText += parsed.text
          onChunk(fullText)
        }
      } catch (e) {
        if (e instanceof Error && e.message !== 'Unexpected end of JSON input') throw e
      }
    }
  }
  return fullText
}
