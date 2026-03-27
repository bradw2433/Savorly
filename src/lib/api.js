// All Claude API calls go through our secure Netlify function.
// The API key never touches the browser.

export const callClaude = async (messages, system = '') => {
  const res = await fetch('/.netlify/functions/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, system }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Server error ${res.status}`)
  }

  const data = await res.json()
  if (data.error) throw new Error(data.error.message || 'API error')
  return data.content?.find(b => b.type === 'text')?.text || ''
}
