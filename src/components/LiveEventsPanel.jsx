import { useEffect, useId, useRef, useState } from 'react'
import { openSseFeed, searchSseEvents, setSseSession } from '../services/sse.js'
import { createSseAccessTokenGetter } from '../services/sseAuth.js'

const EVENT_LIMIT = 100
const FAMILIES = {
  all: 'Todas',
  market: 'Mercado · ofertas y bids',
  wallet: 'Wallet',
  saga: 'Sagas',
  alert: 'Alertas',
}
const CONNECTION_LABELS = {
  connecting: 'Conectando…',
  connected: 'En vivo',
  reconnecting: 'Reconectando…',
  'refreshing-session': 'Renovando sesión…',
  unauthorized: 'Sesión no válida',
  forbidden: 'Acceso denegado',
  unconfigured: 'Origen de eventos no configurado',
  'invalid-cursor': 'Cursor rechazado',
  closed: 'Conexión cerrada',
}
const TERMINAL_STATUSES = ['unauthorized', 'forbidden', 'invalid-cursor', 'unconfigured']
const ORIGINS = {
  INBOUND: 'Entrada',
  OUTBOUND: 'Salida',
  RECONCILIATION: 'Conciliación',
  SAGA: 'Ejecución de saga',
  MONITORING: 'Monitoreo',
}
const FAILURE_STATUSES = new Set(['FAILED', 'NACKED', 'DISCARDED', 'ERROR', 'MISMATCH'])
const ALERTS = {
  'ledger-wallet-delta': { title: 'Diferencia entre ledger y Wallet', severity: 'Alta' },
  'saga-stuck': { title: 'Saga atascada', severity: 'Alta' },
  'outbox-aged': { title: 'Outbox envejecido', severity: 'Aviso' },
  'wallet-slow': { title: 'Wallet lenta', severity: 'Aviso' },
  'consumer-lag': { title: 'Consumidor atrasado', severity: 'Aviso' },
}
const SAGA_STATES = {
  PENDING_START: 'Pendiente de inicio', RUNNING: 'En ejecución', WAITING: 'En espera',
  SETTLED: 'Liquidación registrada por la saga', REJECTED: 'Saga rechazada',
  FAILED: 'Saga fallida', COMPENSATED: 'Saga compensada', TIMED_OUT: 'Saga vencida',
}
const SEARCH_FIELDS = { cycleId: 'ID del ciclo', swapId: 'ID del swap', idpk: 'Clave de correlación (idpk)' }
const EMPTY_SEARCH = { status: 'idle', events: [], next: '' }
const dateFormatter = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'short', timeStyle: 'medium',
})

function describeEvent(event) {
  const { messageType, source, status } = event.data
  if (messageType === 'saga-transition') return Object.hasOwn(SAGA_STATES, status) ? SAGA_STATES[status] : 'Estado de saga registrado'
  if (messageType === 'ledger-wallet-delta') return 'Conciliación divergente registrada'
  if (Object.hasOwn(ALERTS, messageType)) return 'Apertura de alerta observada'
  if (messageType === 'nack') return 'Recepción rechazada por el protocolo'
  if (FAILURE_STATUSES.has(status)) return 'Fallo o discrepancia registrada'
  if (source === 'INBOUND' && status === 'PROCESSED') {
    if (messageType === 'swap-settled') return 'Liquidación confirmada por evento de Wallet'
    if (messageType === 'swap-rejected') return 'Swap rechazado'
    if (messageType === 'swap-expired') return 'Swap vencido'
    if (messageType === 'swap-cancelled') return 'Swap cancelado'
    if (messageType === 'bid-accepted') return 'Aceptación comercial del bid'
    if (messageType === 'bid-rejected') return 'Bid rechazado'
  }
  if (messageType === 'ack' || status === 'ACKED') return 'ACK de protocolo · recepción del mensaje'
  if (status === 'PUBLISHED') return 'Mensaje publicado'
  if (messageType === 'SAGA_START' && status === 'STARTED') return 'Ejecución de saga iniciada'
  return null
}

function EventList({ events, label, onOpenCycle }) {
  return (
    <ol className="live-events-list" aria-label={label}>
      {events.map((event) => {
        const { messageType, source, status } = event.data
        const description = describeEvent(event)
        const alert = Object.hasOwn(ALERTS, messageType) ? ALERTS[messageType] : null
        return (
          <li key={event.id} className="live-events-entry">
            <div className="live-events-entry-main">
              <strong>{alert?.title ?? (messageType === 'saga-transition' ? 'Transición de saga' : messageType)}</strong>
              <span>{FAMILIES[event.type]}</span>
              <span className="live-events-event-status">{status}</span>
              {alert && <span className="live-events-severity" data-severity={alert.severity}>{alert.severity}</span>}
            </div>
            {description && <p>{description}</p>}
            <div className="live-events-meta">
              <span>#{event.id}</span>
              <time dateTime={event.occurredAt}>{dateFormatter.format(new Date(event.occurredAt))}</time>
              <span>{ORIGINS[source]}</span>
              {event.cycleId !== null && <span>Ciclo {event.cycleId}</span>}
            </div>
            <details className="live-events-detail">
              <summary>Detalle del evento #{event.id}</summary>
              <p>Código: <code>{messageType}</code></p>
              {alert && <p>Prioridad visual: {alert.severity}</p>}
              {event.cycleId && onOpenCycle && (
                <button type="button" className="module-back-button" onClick={() => onOpenCycle(event.cycleId)}>
                  Ver detalle del ciclo
                </button>
              )}
            </details>
          </li>
        )
      })}
    </ol>
  )
}

function LiveEventsFeed({ subject, getAccessTokenSilently, onOpenCycle }) {
  const [events, setEvents] = useState([])
  const [family, setFamily] = useState('all')
  const [status, setStatus] = useState('connecting')
  const [interrupted, setInterrupted] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [lastSignal, setLastSignal] = useState(null)
  const [stale, setStale] = useState(false)
  const [deliveryLag, setDeliveryLag] = useState(null)
  const [searchField, setSearchField] = useState('cycleId')
  const [search, setSearch] = useState(EMPTY_SEARCH)
  const searchRun = useRef(null)
  const searchSelector = useRef(null)
  const feed = useRef(null)
  const searchInput = useRef(null)
  const filterId = useId()
  const searchId = useId()

  function clearSearch() {
    searchRun.current?.abort()
    searchRun.current = null
    searchSelector.current = null
    if (searchInput.current) searchInput.current.value = ''
    setSearch(EMPTY_SEARCH)
  }

  async function runSearch(selector, after) {
    searchRun.current?.abort()
    const controller = new AbortController()
    searchRun.current = controller
    searchSelector.current = null
    setSearch({ ...EMPTY_SEARCH, status: 'loading' })
    const result = await searchSseEvents({ ...selector, after, signal: controller.signal })
      .catch(() => ({ status: 'unavailable' }))
    if (controller.signal.aborted) return
    searchRun.current = null
    if (result.status === 'forbidden' || result.status === 'unauthorized') {
      if (result.status === 'forbidden') feed.current?.revoke()
      else feed.current?.close()
      clearSearch()
      setEvents([])
      setLastSignal(null)
      setDeliveryLag(null)
      setStatus(result.status)
      return
    }
    if (result.next) searchSelector.current = selector
    setSearch({ ...EMPTY_SEARCH, ...result })
  }

  function submitSearch(event) {
    event.preventDefault()
    const value = searchInput.current.value
    searchInput.current.value = ''
    void runSearch({ field: searchField, value })
  }

  useEffect(() => {
    let active = true
    let connection
    let freshnessTimer
    function markSignal(receivedAt = Date.now()) {
      if (!active) return
      setLastSignal(receivedAt)
      setStale(false)
      clearTimeout(freshnessTimer)
      freshnessTimer = setTimeout(() => setStale(true), 45000)
    }

    try {
      const getAccessToken = getAccessTokenSilently ?? createSseAccessTokenGetter()
      setSseSession(subject, ({ forceRefresh }) => getAccessToken({
        authorizationParams: { scope: 'read:events' },
        cacheMode: forceRefresh ? 'off' : 'on',
      }))
      connection = openSseFeed({
        apiUrl: import.meta.env.VITE_SSE_ORIGIN,
        onHeartbeat() { markSignal() },
        onEvent(event) {
          if (!active) return
          const receivedAt = Date.now()
          markSignal(receivedAt)
          const lag = receivedAt - Date.parse(event.occurredAt)
          setDeliveryLag(lag >= 0 ? Math.round(lag / 1000) : null)
          // E3-034 delivers increasing IDs even when capture timestamps go backwards.
          setEvents((current) => (current.length && BigInt(event.id) <= BigInt(current[0].id)
            ? current
            : [event, ...current].slice(0, EVENT_LIMIT)))
        },
        onStatus(next) {
          if (!active) return
          setStatus((previous) => next === 'closed' && TERMINAL_STATUSES.includes(previous)
            ? previous
            : next)
          if (next === 'connected') {
            setInterrupted(false)
            markSignal()
          } else {
            clearTimeout(freshnessTimer)
          }
          if (TERMINAL_STATUSES.includes(next) || next === 'refreshing-session' || next === 'closed') {
            setEvents([])
            setLastSignal(null)
            setDeliveryLag(null)
            clearSearch()
          }
        },
        onError() {
          if (active) setInterrupted(true)
        },
      })
      feed.current = connection
    } catch {
      // Keep configuration details and any transport error out of the UI.
      queueMicrotask(() => { if (active) setStatus('unconfigured') })
    }

    return () => {
      active = false
      clearTimeout(freshnessTimer)
      searchRun.current?.abort()
      searchSelector.current = null
      feed.current = null
      connection?.close()
      setSseSession(null)
    }
  }, [subject, attempt, getAccessTokenSilently])

  function restart() {
    setEvents([])
    setInterrupted(false)
    setStatus('connecting')
    setAttempt((current) => current + 1)
  }

  const visible = family === 'all' ? events : events.filter((event) => event.type === family)
  const searchAvailable = status === 'connected' || status === 'reconnecting'
  const visibleMatches = family === 'all' ? search.events : search.events.filter((event) => event.type === family)
  const failure = TERMINAL_STATUSES.includes(status) || status === 'closed'

  return (
    <>
      <div className="live-events-toolbar">
        <p className={`live-events-status live-events-status--${status}`} role="status">
          {CONNECTION_LABELS[status]}
        </p>
        <div className="live-events-filter">
          <label htmlFor={filterId}>Familia de eventos</label>
          <select id={filterId} value={family} onChange={(event) => setFamily(event.target.value)}>
            {Object.entries(FAMILIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </div>

      {status === 'unauthorized' && <p className="live-events-error" role="alert">
        Vuelve a iniciar sesión para leer los eventos.
      </p>}
      {status === 'forbidden' && <p className="live-events-error" role="alert">
        Tu cuenta no tiene permiso para leer eventos. Solicita acceso.
      </p>}
      {status === 'unconfigured' && <p className="live-events-error" role="alert">
        El origen de actividad en vivo no está disponible en este ambiente.
      </p>}
      {status === 'invalid-cursor' && <p className="live-events-error" role="alert">
        El servidor rechazó el cursor. Puedes volver a cargar el historial desde el inicio.
      </p>}
      {status === 'closed' && <p className="live-events-error" role="alert">No se pudo mantener el flujo de eventos.</p>}
      {status === 'reconnecting' && interrupted && <p className="live-events-error" role="alert">
        No se pudo conectar con el flujo. La reconexión automática conserva la posición de lectura.
      </p>}
      {['invalid-cursor', 'closed'].includes(status) && (
        <button className="page-action-button" type="button" onClick={restart}>
          {status === 'invalid-cursor' ? 'Volver a cargar historial' : 'Reintentar conexión'}
        </button>
      )}

      {lastSignal !== null && (
        <p className="live-events-context">
          Última señal del flujo <time dateTime={new Date(lastSignal).toISOString()}>{dateFormatter.format(lastSignal)}</time>.
          {deliveryLag !== null && <> Retraso de entrega del último evento: {deliveryLag} s.</>}
        </p>
      )}
      {status === 'connected' && stale && <p className="live-events-error" role="alert">
        El flujo lleva al menos 45 s sin señales.
      </p>}

      {searchAvailable && (
        <section className="live-events-search" aria-labelledby={searchId + '-heading'}>
          <h2 id={searchId + '-heading'}>Buscar por correlación</h2>
          <form className="live-events-search-form" onSubmit={submitSearch} autoComplete="off">
            <div className="live-events-filter">
              <label htmlFor={searchId + '-field'}>Buscar por</label>
              <select id={searchId + '-field'} value={searchField} onChange={(event) => {
                clearSearch()
                setSearchField(event.target.value)
              }}>
                {Object.entries(SEARCH_FIELDS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </div>
            <div className="live-events-filter">
              <label htmlFor={searchId + '-value'}>{SEARCH_FIELDS[searchField]}</label>
              <input id={searchId + '-value'} ref={searchInput} type={searchField === 'idpk' ? 'password' : 'text'}
                required maxLength={256} autoComplete="off" spellCheck={false} />
            </div>
            <button type="submit" className="page-action-button">Buscar eventos</button>
            {search.status !== 'idle' && <button type="button" className="module-back-button" onClick={clearSearch}>
              Limpiar búsqueda
            </button>}
          </form>
          <p role="status">
            {search.status === 'loading' && 'Buscando eventos publicados…'}
            {search.status === 'ready' && (search.events.length
              ? `${visibleMatches.length} de ${search.events.length} coincidencias en esta página.`
              : 'Sin coincidencias en esta página.')}
          </p>
          {search.status === 'invalid' && <p className="live-events-error" role="alert">El filtro de búsqueda no es válido.</p>}
          {search.status === 'unavailable' && <p className="live-events-error" role="alert">No se pudo completar la búsqueda.</p>}
          {visibleMatches.length > 0 && (
            <EventList events={visibleMatches} label="Resultados de correlación en orden ascendente" onOpenCycle={onOpenCycle} />
          )}
          {search.next && <button type="button" className="module-back-button"
            onClick={() => void runSearch(searchSelector.current, search.next)}>
            Página siguiente
          </button>}
        </section>
      )}

      <h2>{family === 'all' ? 'Eventos recientes' : FAMILIES[family]}</h2>
      {visible.length > 0 && (
        <>
          <p className="live-events-context">{visible.length} de {events.length} eventos · Publicación más reciente primero · Hora local</p>
          <EventList events={visible} label="Eventos en orden descendente de publicación" onOpenCycle={onOpenCycle} />
        </>
      )}
      {!failure && visible.length === 0 && (
        <p className="live-events-empty">
          {events.length > 0 ? 'Sin eventos recientes para esta familia.' : 'Aún no se han recibido eventos en esta vista.'}
        </p>
      )}
    </>
  )
}

export default function LiveEventsPanel({ subject, isAuthLoading, getAccessTokenSilently, onBack, onOpenCycle }) {
  const heading = useRef(null)
  useEffect(() => { heading.current?.focus() }, [])

  return (
    <section className="market-panel live-events" aria-labelledby="live-events-heading">
      <button className="module-back-button" type="button" onClick={onBack}>← Volver a ciclos</button>
      <h1 id="live-events-heading" ref={heading} tabIndex={-1}>Actividad en vivo</h1>
      <p className="live-events-context">
        Hasta {EVENT_LIMIT} eventos por vista. HTTP 202 confirma recepción de la solicitud por Wallet.
        El ACK confirma recepción del mensaje. La liquidación se confirma con <code>swap-settled</code> procesado.
      </p>
      {isAuthLoading ? <p role="status">Cargando sesión…</p> : subject ? (
        <LiveEventsFeed key={subject} subject={subject} getAccessTokenSilently={getAccessTokenSilently} onOpenCycle={onOpenCycle} />
      ) : <p role="status">Inicia sesión para ver la actividad en vivo.</p>}
    </section>
  )
}
