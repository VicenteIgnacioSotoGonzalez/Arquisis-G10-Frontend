import { useEffect, useMemo, useState } from 'react'
import { getCycles, getSwapDetail, getSwaps } from '../services/api'
import {
  partitionSwaps, swapCounts, swapDate, swapDetailMatches, swapHttpState,
  swapNumber, swapPaymentState, swapRole, swapStatus, swapStatusClass,
  swapText, validSwapPage,
} from '../services/swaps'

const REFRESH_MS = 15_000
const PAGE_SIZE = 20
const STATUS_OPTIONS = ['SUBMITTED', 'PROPOSED', 'ACCEPT_SUBMITTED', 'SETTLED', 'REJECTED', 'EXPIRED', 'CANCELLED']

function SwapTable({ title, swaps, onSelect }) {
  return (
    <section className="detail-card swaps-section">
      <h2>{title} <span className="swaps-count">{swaps.length} en esta página</span></h2>
      {!swaps.length ? <p className="empty-detail">Sin registros para esta categoría en la página actual.</p> : (
        <div className="table-wrapper">
          <table className="swaps-table">
            <thead><tr><th>Swap</th><th>Ciclo / contraparte</th><th>Rol</th><th>Entrega</th><th>Recibe</th><th>Estado</th><th>Registrado</th><th>Detalle</th></tr></thead>
            <tbody>{swaps.map((swap) => (
              <tr key={swap.id}>
                <td><strong>{swapText(swap.swapId)}</strong><small className="cycle-e2-id">Registro #{swap.id}</small></td>
                <td>{swapText(swap.cycleId)}<small className="cycle-e2-id">{swapText(swap.counterpartCityId)}</small></td>
                <td>{swapRole(swap.role)}</td>
                <td>{swapNumber(swap.giveAmount)} {swapText(swap.giveAsset)}</td>
                <td>{swapNumber(swap.takeAmount)} {swapText(swap.takeAsset)}</td>
                <td><span className={swapStatusClass(swap.status)}>{swapStatus(swap.status)}</span></td>
                <td>{swapDate(swap.createdAt)}</td>
                <td><button type="button" className="module-back-button" onClick={() => onSelect(swap.id)}>Ver detalle</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function SwapDetail({ item, onClose }) {
  return (
    <section className="detail-card swaps-detail" aria-label="Detalle del swap">
      <div className="swaps-title-row">
        <h2>Detalle del swap</h2>
        <button type="button" className="module-back-button" onClick={onClose}>Cerrar detalle</button>
      </div>
      <p className="swaps-detail-intro">Swap {swapText(item.swapId)} · registro #{item.id} · {swapRole(item.role)}</p>
      <div className="detail-values">
        <div><span>Estado persistido</span><strong><span className={swapStatusClass(item.status)}>{swapStatus(item.status)}</span></strong></div>
        <div><span>Ciudad contraparte</span><strong>{swapText(item.counterpartCityId)}</strong></div>
        <div><span>Ciclo</span><strong>{swapText(item.cycleId)}</strong></div>
        <div><span>Creación</span><strong>{swapDate(item.createdAt)}</strong></div>
        <div><span>Entrega prevista</span><strong>{swapNumber(item.giveAmount)} {swapText(item.giveAsset)}</strong></div>
        <div><span>Recepción prevista</span><strong>{swapNumber(item.takeAmount)} {swapText(item.takeAsset)}</strong></div>
        <div><span>HTTP 202 registrado</span><strong>{swapDate(item.proposalHttpAcceptedAt)}</strong></div>
        <div><span>Propuesta / aceptación</span><strong>{item.status === 'PROPOSED' ? 'swap-proposed registrado' : swapStatus(item.status)}</strong></div>
        <div><span>Intentos de propuesta</span><strong>{swapNumber(item.proposalAttemptCount, 0)}</strong></div>
        <div><span>Intentos de aceptación</span><strong>{swapNumber(item.acceptAttempts, 0)}</strong></div>
        <div><span>Vencimiento</span><strong>{swapDate(item.expiresAt)}</strong></div>
        <div><span>Liquidación</span><strong>{swapDate(item.settledAt)}</strong></div>
      </div>
      <div className="swaps-timeline">
        <p><strong>Recepción HTTP:</strong> {swapHttpState(item)}</p>
        <p><strong>Pago / liquidación:</strong> {swapPaymentState(item)}</p>
        <p><strong>Motivo de rechazo:</strong> {swapText(item.rejectionReason)}</p>
        {(item.proposalLastError || item.acceptError) && (
          <p><strong>Incidencia técnica:</strong> {swapText(item.proposalLastError || item.acceptError)}</p>
        )}
      </div>
      <p className="market-book-footnote">Los montos corresponden a los activos que el swap propone entregar y recibir. Un HTTP 202 no es settlement. La liquidación se muestra únicamente cuando el backend informa SETTLED. Esta vista no transfiere activos.</p>
    </section>
  )
}

export default function SwapsView({ onBack }) {
  const [cycles, setCycles] = useState([])
  const [cyclesError, setCyclesError] = useState('')
  const [cycleId, setCycleId] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [offset, setOffset] = useState(0)
  const [page, setPage] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailError, setDetailError] = useState('')

  useEffect(() => {
    let active = true
    getCycles().then((data) => {
      if (active) setCycles(Array.isArray(data?.items) ? data.items : [])
    }).catch(() => {
      if (active) setCyclesError('No se pudo consultar la lista de ciclos. Puede usar el filtro general.')
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    let busy = false
    const controller = new AbortController()
    const update = async () => {
      if (!active || busy) return
      busy = true
      try {
        const result = await getSwaps({ cycleId, role, status, offset, limit: PAGE_SIZE, signal: controller.signal })
        if (!active) return
        if (!validSwapPage(result)) throw new Error('Respuesta inesperada')
        setPage(result)
        setError('')
        setUpdatedAt(new Date().toISOString())
      } catch (err) {
        if (active && err.name !== 'AbortError') {
          setError('No fue posible actualizar los swaps. Los resultados visibles pueden estar desactualizados.')
        }
      } finally {
        if (active) setLoading(false)
        busy = false
      }
    }
    update()
    const interval = window.setInterval(update, REFRESH_MS)
    return () => { active = false; controller.abort(); window.clearInterval(interval) }
  }, [cycleId, role, status, offset, refreshKey])

  useEffect(() => {
    if (selectedId == null) return undefined
    let active = true
    const controller = new AbortController()
    getSwapDetail(selectedId, { signal: controller.signal })
      .then((result) => {
        if (!active) return
        if (!swapDetailMatches(result, selectedId, cycleId)) throw new Error('El swap no coincide con los filtros')
        setDetail(result)
      })
      .catch((err) => {
        if (active && err.name !== 'AbortError') setDetailError('No fue posible consultar el detalle del swap.')
      })
    return () => { active = false; controller.abort() }
  }, [selectedId, cycleId, refreshKey])

  const groups = useMemo(() => partitionSwaps(page?.items), [page])
  const counts = useMemo(() => swapCounts(page?.items), [page])

  const selectSwap = (id) => {
    setDetail(null)
    setDetailError('')
    setSelectedId(id)
  }

  const changeFilters = (setter, value) => {
    setPage(null)
    setError('')
    setLoading(true)
    setSelectedId(null)
    setDetail(null)
    setOffset(0)
    setter(value)
  }

  return (
    <div className="swaps-page">
      <button type="button" className="module-back-button" onClick={onBack}>← Volver al historial de ciclos</button>
      <section className="page-header swaps-heading">
        <div>
          <p className="eyebrow">Mercado E2 · RF04</p>
          <h1>Swaps en curso e historial</h1>
          <p className="page-description">Seguimiento de propuestas y resultados de la wallet. La vista diferencia recepción HTTP, estados del swap y liquidación, sin ejecutar pagos.</p>
        </div>
      </section>
      <section className="swaps-controls" aria-label="Filtros de swaps">
        <label>Ciclo
          <select value={cycleId} onChange={(e) => changeFilters(setCycleId, e.target.value)}>
            <option value="">Todos los ciclos</option>
            {cycles.map((c) => <option key={c.cycleId} value={c.cycleId}>{c.cycleId}</option>)}
          </select>
        </label>
        <label>Rol
          <select value={role} onChange={(e) => changeFilters(setRole, e.target.value)}>
            <option value="">Todos los roles</option>
            <option value="PROPOSER">Proponente</option>
            <option value="ACCEPTOR">Aceptante</option>
          </select>
        </label>
        <label>Estado
          <select value={status} onChange={(e) => changeFilters(setStatus, e.target.value)}>
            <option value="">Todos los estados</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{swapStatus(s)}</option>)}
          </select>
        </label>
        <button type="button" className="page-action-button" onClick={() => setRefreshKey((n) => n + 1)}>Actualizar ahora</button>
      </section>
      {cyclesError && <p role="alert" className="market-book-message">{cyclesError}</p>}
      {loading && !page && <p role="status" className="market-book-message">Consultando swaps...</p>}
      {error && <p role="alert" className="market-book-message market-book-error">{error}</p>}
      {page && (
        <>
          <div className="swaps-summary" aria-live="polite">
            <span>Resultados para filtros: <strong>{swapNumber(page.total, 0)}</strong></span>
            <span>En curso (página): <strong>{counts.active}</strong></span>
            <span>Finalizados (página): <strong>{counts.finished}</strong></span>
            <span>Consulta: <strong>{swapDate(updatedAt)}</strong></span>
          </div>
          <SwapTable title="En curso" swaps={groups.active} onSelect={selectSwap} />
          <SwapTable title="Finalizados" swaps={groups.finished} onSelect={selectSwap} />
          {groups.unknown.length > 0 && <SwapTable title="Otros estados informados" swaps={groups.unknown} onSelect={selectSwap} />}
          <div className="swaps-pagination">
            <span>Mostrando {page.items.length ? offset + 1 : 0}–{offset + page.items.length} de {page.total}</span>
            <div>
              <button type="button" className="module-back-button" disabled={offset === 0} onClick={() => { setPage(null); setLoading(true); setOffset((n) => Math.max(0, n - PAGE_SIZE)); setSelectedId(null); setDetail(null); setDetailError('') }}>Anterior</button>
              <button type="button" className="module-back-button" disabled={offset + PAGE_SIZE >= page.total} onClick={() => { setPage(null); setLoading(true); setOffset((n) => n + PAGE_SIZE); setSelectedId(null); setDetail(null); setDetailError('') }}>Siguiente</button>
            </div>
          </div>
        </>
      )}
      {selectedId != null && !detail && !detailError && <p role="status" className="market-book-message">Consultando detalle...</p>}
      {detailError && <p role="alert" className="market-book-message market-book-error">{detailError}</p>}
      {detail && <SwapDetail item={detail} onClose={() => { setSelectedId(null); setDetail(null) }} />}
      <p className="market-book-footnote">Datos procedentes de GET /market/swaps y GET /market/swaps/{'{id}'}. Los totales por estado se refieren a la página cargada, no a todos los ciclos.</p>
    </div>
  )
}
