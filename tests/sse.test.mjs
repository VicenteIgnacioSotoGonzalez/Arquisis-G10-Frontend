import test from 'node:test'
import assert from 'node:assert/strict'
import { createSseParser, openSseFeed } from '../src/services/sse.js'

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
  return `id: ${id}\nevent: ${event}\ndata: ${JSON.stringify({ id: Number(id), type: event, cycleId: 'abc', data: { status: 'PROCESSED' } })}\n\n`
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
