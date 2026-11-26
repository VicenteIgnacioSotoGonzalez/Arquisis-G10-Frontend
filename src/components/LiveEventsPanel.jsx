import { useEffect, useId, useRef, useState } from 'react'
import { openSseFeed, setSseSession } from '../services/sse.js'
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
}
const FAILURE_STATUSES = new Set(['FAILED', 'NACKED', 'DISCARDED', 'ERROR', 'MISMATCH'])
const dateFormatter = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'short', timeStyle: 'medium',
})

function describeEvent(event) {
  const { messageType, source, status } = event.data
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

function LiveEventsFeed({ subject, getAccessTokenSilently }) {
  const [events, setEvents] = useState([])
  const [family, setFamily] = useState('all')
  const [status, setStatus] = useState('connecting')
  const [interrupted, setInterrupted] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const filterId = useId()

  useEffect(() => {
    let active = true
    let connection
    try {
      const getAccessToken = getAccessTokenSilently ?? createSseAccessTokenGetter()
      setSseSession(subject, ({ forceRefresh }) => getAccessToken({
        authorizationParams: { scope: 'read:events' },
        cacheMode: forceRefresh ? 'off' : 'on',
      }))
      connection = openSseFeed({
        apiUrl: import.meta.env.VITE_SSE_ORIGIN,
        onEvent(event) {
          if (!active) return
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
          if (next === 'connected') setInterrupted(false)
          if (TERMINAL_STATUSES.includes(next) || next === 'refreshing-session' || next === 'closed') setEvents([])
        },
        onError() {
          if (active) setInterrupted(true)
        },
      })
    } catch {
      // Keep configuration details and any transport error out of the UI.
      queueMicrotask(() => { if (active) setStatus('unconfigured') })
    }

    return () => {
      active = false
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

      {visible.length > 0 && (
        <>
          <p className="live-events-context">{visible.length} de {events.length} eventos · Publicación más reciente primero · Hora local</p>
          <ol className="live-events-list" aria-label="Eventos en orden descendente de publicación">
            {visible.map((event) => {
              const description = describeEvent(event)
              return (
                <li key={event.id} className="live-events-entry">
                  <div className="live-events-entry-main">
                    <strong>{event.data.messageType}</strong>
                    <span>{FAMILIES[event.type]}</span>
                    <span className="live-events-event-status">{event.data.status}</span>
                  </div>
                  {description && <p>{description}</p>}
                  <div className="live-events-meta">
                    <span>#{event.id}</span>
                    <time dateTime={event.occurredAt}>{dateFormatter.format(new Date(event.occurredAt))}</time>
                    <span>{ORIGINS[event.data.source]}</span>
                    {event.cycleId !== null && <span>Ciclo {event.cycleId}</span>}
                  </div>
                </li>
              )
            })}
          </ol>
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

export default function LiveEventsPanel({ subject, isAuthLoading, getAccessTokenSilently, onBack }) {
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
        <LiveEventsFeed key={subject} subject={subject} getAccessTokenSilently={getAccessTokenSilently} />
      ) : <p role="status">Inicia sesión para ver la actividad en vivo.</p>}
    </section>
  )
}
