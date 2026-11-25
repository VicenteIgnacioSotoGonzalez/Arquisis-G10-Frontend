import test from 'node:test'
import assert from 'node:assert/strict'
import { createSseParser, openSseFeed, setSseSession } from '../src/services/sse.js'

const body = (text) => new ReadableStream({
  start(controller) {
    const bytes = new TextEncoder().encode(text)
    controller.enqueue(bytes.subarray(0, 9))
    controller.enqueue(bytes.subarray(9))
    controller.close()
  },
})

function response(text, status = 200, contentType = 'text/event-stream') {
  return new Response(body(text), { status, headers: { 'Content-Type': contentType } })
}

function frame(id, event = 'market') {
  const fields = JSON.stringify({
    type: event, occurredAt: '2026-11-25T10:00:00Z', cycleId: 'ciclé',
    data: { source: 'INBOUND', messageType: 'offer', status: 'PROCESSED' },
  })
  return `id: ${id}\nevent: ${event}\ndata: {"id":${id},${fields.slice(1)}\n\n`
}

test('parser handles CRLF, split chunks, multiline frames and keepalives', () => {
  const frames = []
  const parser = createSseParser((f) => frames.push(f))
  parser.push(': heartbeat\r\n\r\nid: 10\r\nevent: wallet\r\ndata: {"x":\r\n')
  parser.push('data: 1}\r\n\r\n')
  assert.deepEqual(frames, [{ id: '10', event: 'wallet', data: '{"x":\n1}' }])
})

test('fetch transports Bearer token in header and Last-Event-ID; ignores duplicates', async () => {
  const events = []
  const requests = []
  const feed = openSseFeed({
    apiUrl: 'https://api.test.local',
    lastEventId: '9',
    tokenProvider: async () => 'dummy-token',
    reconnect: false,
    onEvent: (event) => events.push(event.id),
    fetchImpl: async (url, init) => {
      requests.push({ url, init })
      return response(`${frame(9)}${frame(10)}${frame(10)}${frame(11, 'wallet')}`)
    },
  })
  await feed.done
  assert.deepEqual(events, [10, 11])
  assert.equal(feed.getLastEventId(), '11')
  assert.equal(requests[0].init.headers.Authorization, 'Bearer dummy-token')
  assert.equal(requests[0].init.headers['Last-Event-ID'], '9')
  assert.ok(!requests[0].url.includes('dummy-token'))
})

test('401 does not retry or expose credentials', async () => {
  const statuses = []
  let requests = 0
  const feed = openSseFeed({
    apiUrl: 'https://api.test.local',
    tokenProvider: async () => 'dummy-token',
    onEvent: () => {},
    onStatus: (x) => statuses.push(x),
    onError: () => {},
    fetchImpl: async () => { requests++; return response('', 401) },
  })
  await feed.done
  assert.equal(requests, 1)
  assert.ok(statuses.includes('unauthorized'))
})

test('invalid event data and comments never advance cursor', async () => {
  const values = []
  const feed = openSseFeed({
    apiUrl: 'https://api.test.local',
    reconnect: false,
    tokenProvider: async () => 'jwt',
    onEvent: (event) => values.push(event.id),
    fetchImpl: async () => response(': heartbeat\n\nid: 2\nevent: unknown\ndata: {}\n\nid: 3\nevent: market\ndata: {wrong}\n\n' + frame(4)),
  })
  await feed.done
  assert.deepEqual(values, [4])
  assert.equal(feed.getLastEventId(), '4')
})

test('reconnects with the last delivered id, never repeating an event', async () => {
  const seen = []
  const cursors = []
  let connection
  connection = openSseFeed({
    apiUrl: 'https://api.test.local',
    minRetryMs: 0,
    maxRetryMs: 0,
    tokenProvider: async () => 'fresh-access-token',
    onEvent: (event) => {
      seen.push(event.id)
      if (event.id === 12) connection.close()
    },
    fetchImpl: async (url, init) => {
      cursors.push(init.headers['Last-Event-ID'] ?? '')
      return response(cursors.length === 1 ? frame(11) : `${frame(11)}${frame(12)}`)
    },
  })
  await connection.done
  assert.deepEqual(cursors, ['', '11'])
  assert.deepEqual(seen, [11, 12])
  assert.equal(connection.getLastEventId(), '12')
})

const apiUrl = 'https://api.test.local'
const now = () => Math.floor(Date.now() / 1000)

function jwt(sub, claims = {}) {
  return 'test.' + Buffer.from(JSON.stringify({
    iss: 'https://issuer.test/', aud: 'energyshark', sub, scope: 'read:events', exp: now() + 300, ...claims,
  })).toString('base64url') + '.fake-signature'
}

function storageFixture() {
  const entries = new Map()
  return {
    entries,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  }
}

function latch() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

test('truncated frames and repeated cuts resume from the last fully handled id', async () => {
  const requested = []
  const seen = []
  const frames = [
    frame(1) + frame(2).slice(0, -1),
    frame(1) + frame(2) + frame(3).slice(0, -5),
    frame(3) + frame(2) + frame(4),
  ]
  const connection = openSseFeed({
    apiUrl, tokenProvider: async () => 'token', minRetryMs: 0, maxRetryMs: 0,
    onEvent(event) {
      seen.push(event.id)
      if (event.id === 4) connection.close()
    },
    fetchImpl: async (_url, init) => {
      requested.push(init.headers['Last-Event-ID'])
      const next = frames[requested.length - 1]
      if (!next) connection.close()
      return response(next ?? '')
    },
  })
  await connection.done
  assert.deepEqual(requested, [undefined, '1', '2'])
  assert.deepEqual(seen, [1, 2, 3, 4])
  assert.equal(connection.getLastEventId(), '4')
})

test('decoder handles split UTF-8 and CRLF boundaries; integer cursor stays exact', async () => {
  const seen = []
  const id = '9223372036854775807'
  const bytes = new TextEncoder().encode(frame(id).replaceAll('\n', '\r\n'))
  const stream = new ReadableStream({
    start(controller) {
      for (const byte of bytes) controller.enqueue(Uint8Array.of(byte))
      controller.close()
    },
  })
  const connection = openSseFeed({
    apiUrl, tokenProvider: async () => 'token', reconnect: false,
    onEvent: (event) => seen.push(event),
    fetchImpl: async () => new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } }),
  })
  await connection.done
  assert.equal(seen[0].id, id)
  assert.equal(seen[0].cycleId, 'ciclé')
  assert.equal(connection.getLastEventId(), id)
})

test('invalid and out-of-order ids never reach the consumer', async () => {
  const seen = []
  const connection = openSseFeed({
    apiUrl, tokenProvider: async () => 'token', reconnect: false,
    onEvent: (event) => seen.push(event.id),
    fetchImpl: async () => response(frame(5) + frame(4) + frame(5)
      + frame('9223372036854775808') + frame('06')
      + frame(6).replace('"id":6', '"id":7') + frame(6)),
  })
  await connection.done
  assert.deepEqual(seen, [5, 6])
  assert.equal(connection.getLastEventId(), '6')
})

test('only persists completed events and retries a rejected consumer callback', async () => {
  const storage = storageFixture()
  const processing = latch()
  const release = latch()
  const requested = []
  let failures = 0
  let delivered = 0
  const connection = openSseFeed({
    apiUrl, storage, minRetryMs: 0, maxRetryMs: 0, tokenProvider: async () => jwt('alice'),
    async onEvent(event) {
      assert.equal(event.id, 1)
      delivered++
      if (delivered === 1) {
        processing.resolve()
        await release.promise
        throw new Error('display did not finish')
      }
      connection.close()
    },
    onError() { failures++ },
    fetchImpl: async (_url, init) => {
      requested.push(init.headers['Last-Event-ID'])
      return response(frame(1))
    },
  })
  await processing.promise
  assert.equal(connection.getLastEventId(), '')
  assert.equal(storage.entries.size, 0)
  release.resolve()
  await connection.done
  assert.equal(failures, 1)
  assert.deepEqual(requested, [undefined, undefined])
  assert.deepEqual([...storage.entries.values()], ['1'])
})

test('login restores only the cursor for the same account, scope, and API', async (t) => {
  t.after(() => setSseSession(null))
  const storage = storageFixture()
  const requested = []
  const seen = []
  async function open(token, subject, content, endpoint = apiUrl) {
    setSseSession(subject, async () => token)
    const feed = openSseFeed({
      apiUrl: endpoint, storage, reconnect: false, onEvent: (event) => seen.push(event.id),
      fetchImpl: async (_url, init) => {
        requested.push(init.headers['Last-Event-ID'])
        return response(content)
      },
    })
    await feed.done
  }

  await open(jwt('alice'), 'alice', frame(4))
  setSseSession(null)
  await open(jwt('bob'), 'bob', frame(1))
  await open(jwt('alice', { exp: now() + 900 }), 'alice', frame(4) + frame(5))
  await open(jwt('alice', { scope: 'read:events extra' }), 'alice', '')
  await open(jwt('alice'), 'alice', '', 'https://other.test')
  assert.deepEqual(requested, [undefined, undefined, '4', undefined, undefined])
  assert.deepEqual(seen, [4, 1, 5])
  assert.deepEqual([...storage.entries.values()].sort(), ['1', '5'])
  for (const key of storage.entries.keys()) assert.match(key, /^energyshark:sse:v1:[a-f0-9]{64}$/)
})

test('an account change cancels an active read and drops pending frames', async (t) => {
  t.after(() => setSseSession(null))
  const storage = storageFixture()
  const processing = latch()
  const release = latch()
  const delivered = []
  let cancelled = false
  let fetchSignal
  const stream = new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode(frame(1) + frame(2))) },
    cancel() { cancelled = true },
  })
  setSseSession('alice', async () => jwt('alice'))
  const connection = openSseFeed({
    apiUrl, storage,
    async onEvent(event) {
      delivered.push(event.id)
      processing.resolve()
      await release.promise
    },
    fetchImpl: async (_url, init) => {
      fetchSignal = init.signal
      return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })
    },
  })
  await processing.promise
  setSseSession('bob', async () => jwt('bob'))
  assert.equal(fetchSignal.aborted, true)
  assert.equal(cancelled, true)
  release.resolve()
  await connection.done
  assert.deepEqual(delivered, [1])
  assert.equal(connection.getLastEventId(), '')
  assert.equal(storage.entries.size, 0)
})

test('logout during token selection never opens a stream', async (t) => {
  t.after(() => setSseSession(null))
  const delayed = latch()
  setSseSession('alice', () => delayed.promise)
  const connection = openSseFeed({
    apiUrl, onEvent: () => assert.fail('unexpected event'),
    fetchImpl: async () => assert.fail('unexpected request'),
  })
  setSseSession(null)
  delayed.resolve(jwt('alice'))
  await connection.done
  assert.equal(connection.getLastEventId(), '')
})

test('expired Auth0 token is refreshed before use; a 401 only refreshes once', async (t) => {
  t.after(() => setSseSession(null))
  const calls = []
  const headers = []
  const statuses = []
  const first = jwt('alice', { exp: now() - 1 })
  const fresh = jwt('alice')
  setSseSession('alice', async ({ forceRefresh }) => {
    calls.push(forceRefresh)
    return forceRefresh ? fresh : first
  })
  const connection = openSseFeed({
    apiUrl, onEvent: () => {}, onStatus: (status) => statuses.push(status),
    fetchImpl: async (_url, init) => {
      headers.push(init.headers.Authorization)
      return response('', 401)
    },
  })
  await connection.done
  assert.deepEqual(calls, [false, true])
  assert.deepEqual(headers, ['Bearer ' + fresh])
  assert.ok(statuses.includes('unauthorized'))
})

test('a current token rejected as 401 retries with a fresh token and the same cursor', async (t) => {
  t.after(() => setSseSession(null))
  const storage = storageFixture()
  const first = jwt('alice')
  const fresh = jwt('alice', { exp: now() + 500 })
  setSseSession('alice', async ({ forceRefresh }) => forceRefresh ? fresh : first)
  const initial = openSseFeed({
    apiUrl, storage, reconnect: false, onEvent: () => {}, fetchImpl: async () => response(frame(4)),
  })
  await initial.done
  const requests = []
  const seen = []
  const connection = openSseFeed({
    apiUrl, storage,
    onEvent(event) { seen.push(event.id); connection.close() },
    fetchImpl: async (_url, { headers }) => {
      requests.push([headers.Authorization, headers['Last-Event-ID']])
      return headers.Authorization === 'Bearer ' + first ? response('', 401) : response(frame(5))
    },
  })
  await connection.done
  assert.deepEqual(requests, [['Bearer ' + first, '4'], ['Bearer ' + fresh, '4']])
  assert.deepEqual(seen, [5])
})

for (const status of [400, 403, 409]) {
  test('HTTP ' + status + ' stops and removes only the affected checkpoint', async () => {
    const storage = storageFixture()
    async function open(subject, content) {
      const cursors = []
      const statuses = []
      const feed = openSseFeed({
        apiUrl, storage, reconnect: typeof content === 'number', tokenProvider: async () => jwt(subject),
        onEvent: () => {}, onStatus: (value) => statuses.push(value),
        fetchImpl: async (_url, init) => {
          cursors.push(init.headers['Last-Event-ID'])
          return typeof content === 'number' ? response('', content) : response(content)
        },
      })
      await feed.done
      return { cursors, statuses }
    }
    await open('bob', frame(2))
    await open('alice', frame(5))
    const { cursors, statuses } = await open('alice', status)
    assert.deepEqual(cursors, ['5'])
    assert.ok(statuses.includes(status === 403 ? 'unauthorized' : 'invalid-cursor'))
    assert.deepEqual([...storage.entries.values()], ['2'])
    assert.deepEqual((await open('alice', '')).cursors, [undefined])
  })
}

test('close cleans up a pending read and interrupts reconnect backoff', async () => {
  const ready = latch()
  let cancellations = 0
  const stream = new ReadableStream({ cancel: () => { cancellations++ } })
  const active = openSseFeed({
    apiUrl, tokenProvider: async () => 'token', onEvent: () => assert.fail('unexpected event'),
    onStatus: (status) => { if (status === 'connected') ready.resolve() },
    fetchImpl: async () => new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } }),
  })
  await ready.promise
  active.close()
  await active.done
  assert.equal(cancellations, 1)

  const waiting = latch()
  let attempts = 0
  const waitingFeed = openSseFeed({
    apiUrl, tokenProvider: async () => 'token', onEvent: () => {},
    onStatus: (status) => { if (status === 'reconnecting') waiting.resolve() },
    fetchImpl: async () => { attempts++; return response('', 503) },
    minRetryMs: 10000,
  })
  await waiting.promise
  waitingFeed.close()
  await waitingFeed.done
  assert.equal(attempts, 1)
})
