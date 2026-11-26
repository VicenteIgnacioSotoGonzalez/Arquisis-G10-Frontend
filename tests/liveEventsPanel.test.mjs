import assert from 'node:assert/strict'
import test from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { act, createElement, StrictMode } from 'react'
import { JSDOM } from 'jsdom'
import { runnerImport } from 'vite'

const apiUrl = 'https://events.test.invalid'
process.env.VITE_API_URL = 'https://api.test.invalid'
process.env.VITE_SSE_ORIGIN = apiUrl
const { module: { default: LiveEventsPanel } } = await runnerImport('/src/components/LiveEventsPanel.jsx', {
  envDir: false,
  mode: 'test',
})

function token(subject, refreshed = false) {
  const claims = Buffer.from(JSON.stringify({
    sub: subject, iss: 'https://auth.test.invalid/', aud: apiUrl, scope: 'read:events',
    exp: Math.floor(Date.now() / 1000) + (refreshed ? 600 : 300),
  })).toString('base64url')
  return `test.${claims}.signature`
}

function frame(id, {
  type = 'market', messageType = 'offer', status = 'PROCESSED', occurredAt = '2026-11-26T16:00:00Z',
} = {}) {
  const data = JSON.stringify({ type, occurredAt, cycleId: 'ciclo-1', data: { source: 'INBOUND', messageType, status } })
  return `id: ${id}\nevent: ${type}\ndata: {"id":${id},${data.slice(1)}\n\n`
}

function stream() {
  let writer
  let cancellations = 0
  const body = new ReadableStream({
    start(controller) { writer = controller },
    cancel() { cancellations += 1 },
  })
  return {
    response: new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }),
    send: (chunk) => writer.enqueue(new TextEncoder().encode(chunk)),
    end: () => writer.close(),
    cancellations: () => cancellations,
  }
}

async function until(condition) {
  const deadline = Date.now() + 3500
  while (!condition() && Date.now() < deadline) await act(async () => { await delay(10) })
  assert.ok(condition(), 'Timed out waiting for the panel to update')
}

async function mount(t, fetchResponse, initialProps = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://frontend.test.invalid' })
  const globals = {
    window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
  }
  const descriptors = Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)])
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { createRoot } = await import('react-dom/client')
  const container = document.querySelector('#root')
  const root = createRoot(container)
  const requests = []
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, `${apiUrl}/events/stream`)
    requests.push(init)
    return fetchResponse(requests.length, init)
  })
  const auth = []
  const account = (subject) => async (options) => {
    auth.push(options)
    return token(subject, options.cacheMode === 'off')
  }
  const defaults = { subject: 'alice', getAccessTokenSilently: account('alice'), onBack() {} }
  const render = (props) => act(async () => {
    root.render(createElement(StrictMode, null, createElement(LiveEventsPanel, { ...defaults, ...props })))
  })
  t.after(async () => {
    await act(async () => root.unmount())
    dom.window.close()
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  })
  await render(initialProps)
  return { container, requests, auth, account, render, clear: () => act(async () => root.render(null)) }
}

const connection = (container) => container.querySelector('[role="status"]')?.textContent
const rows = (container) => Array.from(container.querySelectorAll('ol li'))

async function filter(container, family) {
  const select = container.querySelector('select')
  await act(async () => {
    select.value = family
    select.dispatchEvent(new window.Event('change', { bubbles: true }))
  })
}

test('shows a bounded feed in publication order and filters without a second subscription', async (t) => {
  const feed = stream()
  let connect
  const pendingResponse = new Promise((resolve) => { connect = resolve })
  const { container, requests, auth } = await mount(t, () => pendingResponse)
  await until(() => requests.length === 1)
  assert.equal(connection(container), 'Conectando…')
  assert.equal(document.activeElement, container.querySelector('h1'))
  assert.deepEqual(auth.at(-1), { authorizationParams: { scope: 'read:events' }, cacheMode: 'on' })

  await act(async () => connect(feed.response))
  assert.equal(connection(container), 'En vivo')
  assert.match(container.textContent, /Aún no se han recibido eventos/)
  await act(async () => {
    feed.send(frame(1).repeat(2)
      + frame(2, { type: 'wallet', messageType: 'swap-settled', status: 'RECEIVED' })
      + frame(3, { type: 'wallet', messageType: 'swap-settled', occurredAt: '2026-11-26T15:00:00Z' })
      + frame(4, { type: 'saga', messageType: 'SAGA_START', status: 'FAILED' })
      + frame(5, { type: 'alert', messageType: 'nack', status: 'NACKED' })
      + frame(6, { messageType: 'bid-accepted', status: 'ACKED' })
      + frame(7, { messageType: 'bid-accepted' }))
  })
  assert.deepEqual(rows(container).map((row) => row.querySelector('strong').textContent), [
    'bid-accepted', 'bid-accepted', 'nack', 'SAGA_START', 'swap-settled', 'swap-settled', 'offer',
  ])
  assert.match(rows(container)[0].textContent, /Aceptación comercial/)
  assert.doesNotMatch(rows(container)[0].textContent, /Liquidación confirmada/)
  assert.match(rows(container)[1].textContent, /ACK de protocolo/)
  assert.match(rows(container)[2].textContent, /Recepción rechazada/)
  assert.match(rows(container)[3].textContent, /Fallo o discrepancia/)
  assert.match(rows(container)[4].textContent, /Liquidación confirmada/)
  assert.doesNotMatch(rows(container)[5].textContent, /Liquidación confirmada/)
  assert.equal(rows(container)[4].querySelector('time').dateTime, '2026-11-26T15:00:00Z')
  assert.match(container.textContent, /HTTP 202 confirma recepción de la solicitud/)

  for (const [family, expected] of [['wallet', 2], ['saga', 1], ['alert', 1], ['market', 3]]) {
    await filter(container, family)
    assert.equal(rows(container).length, expected)
  }
  await act(async () => feed.send(Array.from({ length: 100 }, (_, i) => frame(i + 8)).join('')))
  await filter(container, 'wallet')
  assert.match(container.textContent, /Sin eventos recientes para esta familia/)
  await filter(container, 'all')
  assert.equal(rows(container).length, 100)
  assert.equal(requests.length, 1)
})

test('recovers after an outage with Last-Event-ID and cancels on unmount or account change', async (t) => {
  const first = stream()
  const resumed = stream()
  const reopened = stream()
  const otherAccount = stream()
  const responses = [first.response, new Response(null, { status: 503 }), resumed.response, reopened.response, otherAccount.response]
  const { container, requests, render, clear, account } = await mount(t, (number) => responses[number - 1])
  await until(() => connection(container) === 'En vivo')
  await act(async () => first.send(frame(8)))
  await act(async () => first.end())
  assert.equal(connection(container), 'Reconectando…')
  await until(() => Boolean(container.querySelector('[role="alert"]')))
  assert.match(container.querySelector('[role="alert"]').textContent, /conserva la posición/)
  assert.equal(rows(container).length, 1)
  await until(() => requests.length === 3 && connection(container) === 'En vivo')
  assert.equal(container.querySelector('[role="alert"]'), null)
  assert.equal(requests[1].headers['Last-Event-ID'], '8')
  assert.equal(requests[2].headers['Last-Event-ID'], '8')
  await act(async () => resumed.send(frame(8) + frame(9)))
  assert.equal(rows(container).length, 2)

  await clear()
  assert.equal(resumed.cancellations(), 1)
  assert.equal(requests[2].signal.aborted, true)
  await render()
  await until(() => requests.length === 4 && connection(container) === 'En vivo')
  assert.equal(requests[3].headers['Last-Event-ID'], '9')
  await act(async () => reopened.send(frame(10)))
  assert.equal(rows(container).length, 1)
  await render({ subject: 'bob', getAccessTokenSilently: account('bob') })
  await until(() => requests.length === 5 && connection(container) === 'En vivo')
  assert.equal(reopened.cancellations(), 1)
  assert.equal(requests[4].headers['Last-Event-ID'], undefined)
  assert.equal(rows(container).length, 0)

  await render({ subject: null })
  assert.equal(otherAccount.cancellations(), 1)
  assert.match(connection(container), /Inicia sesión/)
  assert.equal(container.querySelector('select'), null)
})

for (const status of [401, 403]) {
  test(`keeps access error visible after HTTP ${status} closes the stream`, async (t) => {
    const { container, requests, auth, render } = await mount(t,
      () => new Response(null, { status }), { isAuthLoading: true })
    assert.equal(connection(container), 'Cargando sesión…')
    assert.equal(requests.length, 0)
    await render({ isAuthLoading: false })
    await until(() => connection(container) === (status === 401 ? 'Sesión no válida' : 'Acceso denegado'))
    assert.match(container.querySelector('[role="alert"]').textContent,
      status === 401 ? /Vuelve a iniciar sesión/ : /permiso para leer eventos/)
    assert.equal(requests.length, status === 401 ? 2 : 1)
    assert.equal(auth.filter(({ cacheMode }) => cacheMode === 'off').length, status === 401 ? 1 : 0)
    assert.equal(rows(container).length, 0)
  })
}

test('a rejected cursor clears the list and offers deliberate replay from the beginning', async (t) => {
  const first = stream()
  const replay = stream()
  const responses = [first.response, new Response(null, { status: 409 }), replay.response]
  const { container, requests } = await mount(t, (number) => responses[number - 1])
  await until(() => connection(container) === 'En vivo')
  await act(async () => first.send(frame(12)))
  assert.equal(rows(container).length, 1)
  await act(async () => first.end())
  await until(() => connection(container) === 'Cursor rechazado')
  assert.equal(requests[1].headers['Last-Event-ID'], '12')
  assert.equal(rows(container).length, 0)
  await act(async () => container.querySelector('.page-action-button').click())
  await until(() => connection(container) === 'En vivo')
  assert.equal(requests[2].headers['Last-Event-ID'], undefined)
  await act(async () => replay.send(frame(1)))
  assert.equal(rows(container).length, 1)
})


test('a 401 clears the visible feed while Auth0 attempts renewal', async (t) => {
  const feed = stream()
  const { container, requests, render } = await mount(t,
    (number) => number === 1 ? feed.response : new Response(null, { status: 401 }),
    { getAccessTokenSilently: ({ cacheMode }) => cacheMode === 'off'
      ? new Promise(() => {})
      : Promise.resolve(token('alice')) })
  await until(() => connection(container) === 'En vivo')
  await act(async () => feed.send(frame(13)))
  assert.equal(rows(container).length, 1)
  await act(async () => feed.end())
  await until(() => connection(container) === 'Renovando sesión…')
  assert.equal(rows(container).length, 0)
  assert.equal(requests[1].headers['Last-Event-ID'], '13')
  await render({ subject: null })
  assert.match(connection(container), /Inicia sesión/)
})
