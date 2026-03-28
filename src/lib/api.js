// All Claude API calls go through our secure Netlify function.
// The API key never touches the browser.

const FRIENDLY_ERRORS = {
  401: "API key issue — please contact support.",
  403: "API access denied. Please check your API key.",
  429: "Too many requests — please wait a moment and try again.",
  500: "Server error — please try again in a moment.",
  503: "Service temporarily unavailable — please try again shortly.",
}

export const callClaude = async (messages, system = '') => {
  let res
  try {
    res = await fetch('/.netlify/functions/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, system }),
    })
  } catch (e) {
    throw new Error("No internet connection. Please check your network and try again.")
  }

  if (!res.ok) {
    const friendly = FRIENDLY_ERRORS[res.status]
    if (friendly) throw new Error(friendly)
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Something went wrong (error ${res.status}). Please try again.`)
  }

  const data = await res.json()

  // Handle Anthropic-level errors
  if (data.error) {
    const msg = data.error.message || ''
    if (msg.includes('credit') || msg.includes('billing') || data.error.type === 'authentication_error') {
      throw new Error("Recipe generation is temporarily unavailable. Please try again later.")
    }
    if (data.error.type === 'overloaded_error') {
      throw new Error("AI is very busy right now — please try again in a moment.")
    }
    throw new Error("Could not generate recipe. Please try again.")
  }

  const text = data.content?.find(b => b.type === 'text')?.text || ''
  if (!text) throw new Error("Got an empty response. Please try again.")
  return text
}
