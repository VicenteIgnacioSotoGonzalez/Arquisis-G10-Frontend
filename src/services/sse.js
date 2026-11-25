/**
 * E3-032/E3-033: authenticated streaming SSE client for a React/Vite SPA.
 * It does not replace apiFetch() (which expects JSON and has a 15s timeout).
 * Integration with the live dashboard belongs to E3-052/E3-054.
 */
import { getToken } from './auth.js'

const EVENTS = new Set(['market', 'wallet', 'saga', 'alert'])

/** Parse a byte stream in pieces, including CRLF, comments and chunk splits. */
export function createSseParser(onMessage) {
  let pending = ''
  let eventName = ''
  let dataLines = []
  let eventId = ''

  function dispatch() {
    if (dataLines.length) {
      onMessage({ id: eventId, event: eventName || 'message', data: dataLines.join('\n') })
    }
    eventName = ''
    dataLines = []
    eventId = ''
  }

  function consume(line) {
    if (line.endsWith('\r')) line = line.slice(0, -1)
    if (!line) return dispatch()
    if (line[0] === ':') return
    const separator = line.indexOf(':')
    const field = separator === -1 ? line : line.slice(0, separator)
    let value = separator === -1 ? '' : line.slice(separator + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    if (field === 'data') dataLines.push(value)
    else if (field === 'event') eventName = value
    else if (field === 'id' && !value.includes('\0')) eventId = value
  }

  return {
    push(text) {
      pending += text
      if (pending.length > 256_000) throw new Error('SSE frame exceeds size limit')
      let end = pending.indexOf('\n')
      while (end !== -1) {
        consume(pending.slice(0, end))
        pending = pending.slice(end + 1)
        end = pending.indexOf('\n')
      }
    },
    finish() {
      // A partially received frame MUST NOT be dispatched on disconnect.
      pending = ''
      eventName = ''
      dataLines = []
      eventId = ''
    },
  }
}

function delay(ms, signal) {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve()
    const timer = setTimeout(done, ms)
    function done() {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
    signal.addEventListener('abort', done, { once: true })
  })
}

function isNewerId(candidate, current) {
  if (!/^[1-9][0-9]*$/.test(candidate)) return false
  if (!current) return true
  try { return BigInt(candidate) > BigInt(current) } catch { return false }
}

/**
 * Opens exactly one long-lived fetch stream (and reconnects after a failure).
 * Calls onEvent with sanitized JSON from our backend. No browser polling.
 * @returns {{ close: () => void, done: Promise<void>, getLastEventId: () => string }}
 */
export function openSseFeed({
  apiUrl = import.meta.env?.VITE_API_URL,
  onEvent,
  onStatus = () => {},
  onError = () => {},
  lastEventId = '',
  tokenProvider = getToken,
  fetchImpl = globalThis.fetch,
  reconnect = true,
  minRetryMs = 1000,
  maxRetryMs = 15000,
} = {}) {
  if (!apiUrl || !/^https?:\/\//.test(apiUrl)) throw new Error('API URL is not configured')
  if (typeof onEvent !== 'function') throw new TypeError('onEvent is required')
  if (typeof tokenProvider !== 'function') throw new TypeError('tokenProvider is required')
  const controller = new AbortController()
  let cursor = String(lastEventId || '')
  let retries = 0
  const url = `${apiUrl.replace(/\/$/, '')}/events/stream`

  async function run() {
    while (!controller.signal.aborted) {
      try {
        const token = await tokenProvider()
        if (controller.signal.aborted) break
        if (!token) {
          onStatus('unauthorized')
          onError(new Error('Authentication required'))
          break
        }
        const headers = { Accept: 'text/event-stream', Authorization: `Bearer ${token}` }
        if (cursor) headers['Last-Event-ID'] = cursor
        onStatus(retries ? 'reconnecting' : 'connecting')
        const response = await fetchImpl(url, {
          method: 'GET', headers, signal: controller.signal, cache: 'no-store',
        })
        if (controller.signal.aborted) break
        if (response.status === 401 || response.status === 403) {
          onStatus('unauthorized')
          onError(new Error('SSE access denied'))
          break
        }
        if (response.status === 409 || response.status === 400) {
          onStatus('invalid-cursor')
          onError(new Error('SSE resume cursor rejected'))
          break
        }
        if (!response.ok || !response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
          throw new Error(`SSE unavailable (HTTP ${response.status})`)
        }
        onStatus('connected')
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        const parser = createSseParser((frame) => {
          if (!EVENTS.has(frame.event) || !isNewerId(frame.id, cursor)) return
          let parsed
          try { parsed = JSON.parse(frame.data) } catch { return }
          if (!parsed || parsed.type !== frame.event || String(parsed.id) !== frame.id) return
          onEvent(parsed)
          cursor = frame.id // Advance after a successful consumer callback.
          retries = 0
        })
        try {
          while (!controller.signal.aborted) {
            const { done, value } = await reader.read()
            if (done) break
            parser.push(decoder.decode(value, { stream: true }))
          }
          parser.finish()
        } finally {
          try { await reader.cancel() } catch { /* connection already closed */ }
          reader.releaseLock()
        }
      } catch (error) {
        if (!controller.signal.aborted) onError(error)
      }
      if (controller.signal.aborted || !reconnect) break
      retries += 1
      onStatus('reconnecting')
      await delay(Math.min(maxRetryMs, minRetryMs * 2 ** Math.min(retries - 1, 8)), controller.signal)
    }
    onStatus('closed')
  }

  return {
    close: () => controller.abort(),
    done: run(),
    getLastEventId: () => cursor,
  }
}
