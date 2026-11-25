const EVENTS = new Set(['market', 'wallet', 'saga', 'alert'])
const SOURCES = new Set(['INBOUND', 'OUTBOUND', 'RECONCILIATION'])
const MAX_ID = 9223372036854775807n
const MAX_FRAME = 256_000
const STORAGE_PREFIX = 'energyshark:sse:v1:'
let session = null

/** Bind the stream to the current Auth0 account without affecting apiFetch. */
export function setSseSession(subject, tokenProvider) {
  if (subject && session?.subject === subject) {
    session.tokenProvider = tokenProvider
    return
  }

  const previous = session
  session = subject ? { subject, tokenProvider, connections: new Set() } : null
  previous?.connections.forEach((invalidate) => invalidate())
}

/** Parse SSE lines across chunk boundaries, including CRLF and comments. */
export function createSseParser(onMessage) {
  let pending = ''
  let eventName = ''
  let dataLines = []
  let eventId = ''
  let frameSize = 0
  let skipLF = false

  function resetFrame() {
    eventName = ''
    dataLines = []
    eventId = ''
    frameSize = 0
  }

  function consume(line) {
    if (!line) {
      const frame = { id: eventId, event: eventName || 'message', data: dataLines.join('\n') }
      const dispatch = dataLines.length > 0
      resetFrame()
      if (dispatch) onMessage(frame)
      return
    }

    frameSize += line.length + 1
    if (frameSize > MAX_FRAME) throw new Error('SSE frame exceeds size limit')
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
    push(chunk) {
      if (!chunk.length) return
      const text = pending + (skipLF && chunk[0] === '\n' ? chunk.slice(1) : chunk)
      skipLF = false
      const endings = /[\r\n]/g
      let start = 0
      for (let end = endings.exec(text); end; end = endings.exec(text)) {
        consume(text.slice(start, end.index))
        start = end.index + 1
        if (end[0] === '\r') {
          if (text[start] === '\n') start += 1
          else if (start === text.length) skipLF = true
        }
        endings.lastIndex = start
      }
      pending = text.slice(start)
      if (frameSize + pending.length > MAX_FRAME) throw new Error('SSE frame exceeds size limit')
    },
    finish() {
      pending = ''
      skipLF = false
      resetFrame()
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

function validId(value) {
  return typeof value === 'string' && /^[1-9][0-9]{0,18}$/.test(value) && BigInt(value) <= MAX_ID
}

function newerId(value, cursor) {
  return validId(value) && (!cursor || BigInt(value) > BigInt(cursor))
}

function parseEvent(frame) {
  if (!EVENTS.has(frame.event)) return null
  let event
  try {
    event = JSON.parse(frame.data, (key, value, context) => {
      // Keep a large wire integer exact on clients supporting JSON source text.
      if (key === 'id' && typeof value === 'number' && !Number.isSafeInteger(value)
        && validId(context?.source)) return BigInt(context.source)
      return value
    })
  } catch {
    return null
  }
  const id = event?.id
  if (!(typeof id === 'bigint' || Number.isSafeInteger(id)) || String(id) !== frame.id
    || event.type !== frame.event || typeof event.occurredAt !== 'string'
    || !event.occurredAt.endsWith('Z') || !Number.isFinite(Date.parse(event.occurredAt))
    || (event.cycleId !== null && typeof event.cycleId !== 'string')) return null
  const data = event.data
  if (!SOURCES.has(data?.source) || typeof data.messageType !== 'string' || typeof data.status !== 'string') return null

  return {
    id: typeof id === 'bigint' ? frame.id : id,
    type: event.type,
    occurredAt: event.occurredAt,
    cycleId: event.cycleId,
    data: { source: data.source, messageType: data.messageType, status: data.status },
  }
}

function tokenClaims(token) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const bytes = Uint8Array.from(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
    const claims = JSON.parse(new TextDecoder().decode(bytes))
    if (typeof claims?.iss === 'string' && claims.iss && typeof claims.sub === 'string'
      && claims.sub.trim() && Number.isFinite(claims.exp)) return claims
  } catch {
    return null
  }
  return null
}

function sortedStrings(values) {
  return Array.isArray(values) ? [...new Set(values.filter((value) => typeof value === 'string'))].sort() : []
}

function authorizationKey(url, claims) {
  return JSON.stringify([
    url, claims.iss, claims.sub,
    sortedStrings(typeof claims.aud === 'string' ? [claims.aud] : claims.aud),
    sortedStrings(typeof claims.scope === 'string' ? claims.scope.split(/\s+/).filter(Boolean) : []),
    sortedStrings(claims.permissions), claims.org_id ?? null,
  ])
}

async function storageKey(authority) {
  if (!authority || !globalThis.crypto?.subtle) return null
  try {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(authority))
    return STORAGE_PREFIX + Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  } catch {
    return null
  }
}

function checkpoints(storage, key) {
  function access(operation) {
    if (!key) return
    try {
      const target = storage === undefined ? globalThis.localStorage : storage
      if (target) return operation(target)
    } catch {
      // Private mode, storage quota or browser policy can leave replay memory-only.
    }
  }
  return {
    load: () => access((target) => {
      const value = target.getItem(key)
      if (validId(value)) return value
      if (value !== null) target.removeItem(key)
      return ''
    }) || '',
    save: (id) => access((target) => {
      const previous = target.getItem(key)
      if (!validId(previous) || newerId(id, previous)) target.setItem(key, id)
    }),
    clear: () => access((target) => target.removeItem(key)),
  }
}

const AUTH_ERRORS = new Set(['login_required', 'consent_required', 'interaction_required', 'missing_refresh_token'])

/** Open a Bearer SSE connection. Consumer callbacks may acknowledge asynchronously. */
export function openSseFeed({
  apiUrl = import.meta.env?.VITE_API_URL,
  onEvent,
  onStatus = () => {},
  onError = () => {},
  lastEventId = '',
  tokenProvider,
  fetchImpl = globalThis.fetch,
  storage,
  reconnect = true,
  minRetryMs = 1000,
  maxRetryMs = 15000,
} = {}) {
  if (!apiUrl || !/^https?:\/\//.test(apiUrl)) throw new Error('API URL is not configured')
  if (typeof onEvent !== 'function') throw new TypeError('onEvent is required')
  if (tokenProvider !== undefined && typeof tokenProvider !== 'function') throw new TypeError('tokenProvider is required')

  const managed = tokenProvider === undefined
  const boundSession = managed ? session : null
  const controller = new AbortController()
  const { signal } = controller
  const url = apiUrl.replace(/\/+$/, '') + '/events/stream'
  let cursor = !managed && validId(lastEventId) ? lastEventId : ''
  let authority
  let checkpoint
  let retries = 0
  let invalidated = false

  function invalidate() {
    invalidated = true
    cursor = ''
    controller.abort()
  }
  boundSession?.connections.add(invalidate)

  async function consume(response) {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    const frames = []
    const parser = createSseParser((frame) => frames.push(frame))
    const cancel = () => { void reader.cancel().catch(() => {}) }
    signal.addEventListener('abort', cancel, { once: true })
    try {
      while (!signal.aborted) {
        const { done, value } = await reader.read()
        if (done || signal.aborted) break
        parser.push(decoder.decode(value, { stream: true }))
        for (const frame of frames) {
          if (signal.aborted) break
          if (!newerId(frame.id, cursor)) continue
          const event = parseEvent(frame)
          if (!event) continue
          await onEvent(event, signal)
          if (invalidated) break
          cursor = frame.id
          checkpoint.save(cursor)
          retries = 0
        }
        frames.length = 0
      }
    } finally {
      parser.finish()
      signal.removeEventListener('abort', cancel)
      cancel()
      reader.releaseLock()
    }
  }

  function denied(message) {
    onStatus('unauthorized')
    onError(new Error(message))
  }

  async function run() {
    let forceRefresh = false
    let rejectedToken
    try {
      while (!signal.aborted) {
        try {
          const getAccess = tokenProvider ?? boundSession?.tokenProvider
          const token = await getAccess?.({ forceRefresh })
          if (signal.aborted) break
          const claims = typeof token === 'string' ? tokenClaims(token) : null
          if (!token || (managed && claims?.sub !== boundSession?.subject) || token === rejectedToken) {
            denied('Authentication required')
            break
          }
          if (claims && claims.exp <= Date.now() / 1000) {
            if (forceRefresh) {
              denied('SSE token expired')
              break
            }
            rejectedToken = token
            forceRefresh = true
            continue
          }
          const nextAuthority = claims ? authorizationKey(url, claims) : null
          if (authority === undefined) {
            authority = nextAuthority
            checkpoint = checkpoints(storage, await storageKey(authority))
            if (signal.aborted) break
            if (authority) cursor = checkpoint.load()
          } else if (nextAuthority !== authority) {
            invalidate()
            break
          }

          const headers = { Accept: 'text/event-stream', Authorization: 'Bearer ' + token }
          if (cursor) headers['Last-Event-ID'] = cursor
          onStatus(retries || forceRefresh ? 'reconnecting' : 'connecting')
          if (signal.aborted) break
          const response = await fetchImpl(url, {
            method: 'GET', headers, signal, cache: 'no-store',
          })
          if (signal.aborted) {
            void response.body?.cancel().catch(() => {})
            break
          }
          if (!response.ok) void response.body?.cancel().catch(() => {})
          if (response.status === 401 && managed && !forceRefresh && reconnect) {
            rejectedToken = token
            forceRefresh = true
            continue
          }
          if (response.status === 401 || response.status === 403) {
            if (response.status === 403) {
              checkpoint.clear()
              cursor = ''
            }
            denied('SSE access denied')
            break
          }
          if (response.status === 400 || response.status === 409) {
            checkpoint.clear()
            cursor = ''
            onStatus('invalid-cursor')
            onError(new Error('SSE resume cursor rejected'))
            break
          }
          if (!response.ok || !response.body
            || response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'text/event-stream') {
            if (response.ok) void response.body?.cancel().catch(() => {})
            throw new Error('SSE unavailable')
          }
          forceRefresh = false
          rejectedToken = undefined
          onStatus('connected')
          if (signal.aborted) {
            void response.body.cancel().catch(() => {})
            break
          }
          await consume(response)
        } catch (error) {
          if (signal.aborted) break
          if (AUTH_ERRORS.has(error?.error)) {
            denied('Authentication required')
            break
          }
          onError(new Error('SSE connection interrupted'))
        }
        if (signal.aborted || !reconnect) break
        retries += 1
        onStatus('reconnecting')
        await delay(Math.min(maxRetryMs, minRetryMs * 2 ** Math.min(retries - 1, 8)), signal)
      }
    } finally {
      boundSession?.connections.delete(invalidate)
      onStatus('closed')
    }
  }

  return {
    close: () => controller.abort(),
    done: run(),
    getLastEventId: () => managed && boundSession !== session ? '' : cursor,
  }
}
