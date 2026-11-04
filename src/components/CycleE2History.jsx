import { useEffect, useState } from 'react'
import { getCycleHistory } from '../services/api'
import {
  historyCounts, historyDate, historyLastEffect, historyList,
  historyMatchesCycle, historyNumber, historyStatus, historyStatusClass, historyText,
} from '../services/cycleHistory'

const REFRESH_MS = 15_000

function Status({ value }) {
  return <span className={historyStatusClass(value)}>{historyStatus(value)}</span>
}

function Value({ label, children }) {
  return <div><span>{label}</span><strong>{children}</strong></div>
}

function HistoryTable({ items, columns, empty, getKey }) {
  if (!items.length) return <p className="empty-detail">{empty}</p>
  return (
    <div className="table-wrapper">
      <table className="cycle-e2-table">
        <thead><tr>{columns.map(({ title }) => <th key={title}>{title}</th>)}</tr></thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={getKey?.(item) ?? index}>
              {columns.map(({ title, render }) => <td key={title}>{render(item)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Section({ title, count, description, children }) {
  return (
    <section className="detail-card cycle-e2-section">
      <div className="cycle-e2-title">
        <h2>{title}</h2>
        {count != null && <span className="cycle-e2-count">{count} registros</span>}
      </div>
      {description && <p className="cycle-e2-caption">{description}</p>}
      {children}
    </section>
  )
}

function HistoryContents({ history }) {
  const counts = historyCounts(history)
  const energy = history.statusStatement?.energy ?? {}
  const market = history.statusStatement?.market ?? {}
  const funding = historyList(history.funding)
  const offers = historyList(history.offers)
  const revisions = historyList(history.offerRevisions)
  const bids = historyList(history.bids)
  const swaps = historyList(history.swaps)
  const trades = historyList(history.trades)
  const settlements = historyList(history.settlements)
  const reports = historyList(history.negotiationReports)
  const lastEffect = historyLastEffect(history)

  return (
    <>
      <Section title="Estado inicial y ventanas del mercado">
        <div className="detail-values">
          <Value label="Energía vendible">{historyNumber(energy.sellable, 0)} kWh</Value>
          <Value label="Precio de recompra">{historyNumber(market.buybackPrice)} CR/kWh</Value>
          <Value label="Bid mínimo">{historyNumber(market.minBid, 0)} kWh</Value>
          <Value label="Versión de estrategia">{historyText(history.strategyVersion)}</Value>
          <Value label="Apertura del mercado">{historyDate(history.marketOpensAt)}</Value>
          <Value label="Última oferta">{historyDate(history.marketLastOfferAt)}</Value>
          <Value label="Último bid">{historyDate(history.marketLastBidAt)}</Value>
          <Value label="Cierre del mercado">{historyDate(history.marketClosesAt)}</Value>
        </div>
      </Section>

      <Section title="Financiamiento recibido" count={funding.length}>
        <HistoryTable items={funding} empty="No se registran transferencias de fondos para este ciclo."
          getKey={(item) => item.idpk}
          columns={[
            { title: 'Operación', render: (item) => historyText(item.operationType) },
            { title: 'Δ Créditos', render: (item) => historyNumber(item.budgetDelta) },
            { title: 'Créditos después', render: (item) => historyNumber(item.budgetAfter) },
            { title: 'Fecha', render: (item) => historyDate(item.appliedAt) },
          ]} />
      </Section>

      <Section title="Ofertas publicadas" count={counts.offers}>
        <HistoryTable items={offers} empty="No se registran ofertas del ciclo."
          getKey={(item) => item.offerId}
          columns={[
            { title: 'Ciudad / ID', render: (item) => <><strong>{historyText(item.cityId)}</strong><small className="cycle-e2-id">{historyText(item.offerId)}</small></> },
            { title: 'Origen', render: (item) => item.isLocal ? 'Local' : 'Externa' },
            { title: 'Energía inicial', render: (item) => historyNumber(item.initialQuantity, 0) },
            { title: 'Restante', render: (item) => historyNumber(item.remaining, 0) },
            { title: 'Precio nominal', render: (item) => historyNumber(item.pricePerEnergy) },
            { title: 'Estado', render: (item) => <Status value={item.status} /> },
            { title: 'Última actualización', render: (item) => historyDate(item.lastUpdatedAt) },
          ]} />
      </Section>

      <Section title="Revisiones de ofertas" count={counts.offerRevisions}
        description="Publicado indica envío al broker, no aceptación por otra ciudad.">
        <HistoryTable items={revisions} empty="No se registran publicaciones, actualizaciones o retiros de oferta."
          getKey={(item) => item.msgId}
          columns={[
            { title: 'Evento', render: (item) => historyText(item.type) },
            { title: 'Oferta', render: (item) => historyText(item.offerId) },
            { title: 'Restante', render: (item) => historyNumber(item.remaining, 0) },
            { title: 'Precio nominal', render: (item) => historyNumber(item.pricePerEnergy) },
            { title: 'Publicación', render: (item) => <Status value={item.publicationStatus} /> },
            { title: 'Fecha', render: (item) => historyDate(item.publishedAt ?? item.createdAt) },
          ]} />
      </Section>

      <Section title="Bids enviados y recibidos" count={counts.bids}
        description="Una aceptación comercial no equivale a un swap liquidado.">
        <HistoryTable items={bids} empty="No se registran bids del ciclo."
          getKey={(item) => item.idpk}
          columns={[
            { title: 'Dirección', render: (item) => historyStatus(item.direction) },
            { title: 'Contraparte', render: (item) => historyText(item.counterpartCityId) },
            { title: 'Oferta', render: (item) => historyText(item.offerId) },
            { title: 'Cantidad', render: (item) => historyNumber(item.quantity, 0) },
            { title: 'Estado', render: (item) => <Status value={item.status} /> },
            { title: 'Rechazo / disponible', render: (item) => <>{historyText(item.rejectionReason)}{item.availableOnRejection != null && <small className="cycle-e2-id">Disponible: {historyNumber(item.availableOnRejection, 0)}</small>}</> },
            { title: 'Swap', render: (item) => historyText(item.swapId) },
            { title: 'Respuesta', render: (item) => historyDate(item.respondedAt) },
          ]} />
      </Section>

      <Section title="Swaps" count={counts.swaps}
        description="HTTP 202 solo confirma recepción de la propuesta. El estado del swap y su liquidación se registran aparte.">
        <HistoryTable items={swaps} empty="No se registran swaps del ciclo."
          getKey={(item) => item.idpk}
          columns={[
            { title: 'Swap / rol', render: (item) => <>{historyText(item.swapId)}<small className="cycle-e2-id">{historyStatus(item.role)}</small></> },
            { title: 'Contraparte', render: (item) => historyText(item.counterpartCityId) },
            { title: 'Entrega', render: (item) => `${historyNumber(item.giveAmount)} ${historyText(item.giveAsset)}` },
            { title: 'Recibe', render: (item) => `${historyNumber(item.takeAmount)} ${historyText(item.takeAsset)}` },
            { title: 'Estado', render: (item) => <Status value={item.status} /> },
            { title: 'HTTP 202', render: (item) => historyDate(item.proposalHttpAcceptedAt) },
            { title: 'Vencimiento', render: (item) => historyDate(item.expiresAt) },
            { title: 'Liquidación', render: (item) => historyDate(item.settledAt) },
            { title: 'Motivo de rechazo', render: (item) => historyText(item.rejectionReason) },
          ]} />
      </Section>

      <Section title="Trade-recorded y transporte" count={counts.trades}
        description="Eventos de comercio registrados y costos de transporte informados por el backend.">
        <HistoryTable items={trades} empty="No se registran eventos trade-recorded."
          getKey={(item) => item.swapId}
          columns={[
            { title: 'Swap', render: (item) => historyText(item.swapId) },
            { title: 'Vendedor → Comprador', render: (item) => `${historyText(item.seller)} → ${historyText(item.buyer)}` },
            { title: 'Cantidad kWh', render: (item) => historyNumber(item.quantity, 0) },
            { title: 'Precio nominal', render: (item) => historyNumber(item.pricePerEnergy) },
            { title: 'Costo transporte', render: (item) => historyNumber(item.transportTotal) },
            { title: 'Ruta', render: (item) => item.routeEnabled === false ? 'Deshabilitada (tarifa punitiva)' : item.routeEnabled === true ? 'Habilitada' : '—' },
            { title: 'Registro', render: (item) => historyDate(item.recordedAt) },
          ]} />
      </Section>

      <Section title="Imbalance-settlement" count={counts.settlements}>
        <HistoryTable items={settlements} empty="No se registran settlements de desbalance."
          getKey={(item) => item.settlementId}
          columns={[
            { title: 'Settlement', render: (item) => historyText(item.settlementId) },
            { title: 'Cobertura', render: (item) => historyNumber(item.coverage, 0) },
            { title: 'Déficit', render: (item) => historyNumber(item.deficit, 0) },
            { title: 'Precio unitario', render: (item) => historyNumber(item.pricePerEnergy) },
            { title: 'Total', render: (item) => historyNumber(item.total) },
            { title: 'Saldo final', render: (item) => historyNumber(item.balanceAfter) },
            { title: 'Registro', render: (item) => historyDate(item.recordedAt) },
          ]} />
      </Section>

      <Section title="Reportes de negociación E2" count={counts.negotiationReports}
        description="Publicado corresponde al envío del reporte, no a su aprobación por la central.">
        <HistoryTable items={reports} empty="No se registran reportes para este ciclo."
          getKey={(item) => item.idpk}
          columns={[
            { title: 'Estado', render: (item) => <Status value={item.status} /> },
            { title: 'Budget', render: (item) => historyNumber(item.budgetBalance) },
            { title: 'Energía', render: (item) => historyNumber(item.energyBalance) },
            { title: 'Motivo', render: (item) => historyText(item.reason) },
            { title: 'Creación', render: (item) => historyDate(item.createdAt) },
            { title: 'Publicación', render: (item) => historyDate(item.sentAt) },
          ]} />
      </Section>

      <Section title="Último efecto del ledger E2">
        {!lastEffect ? <p className="empty-detail">No hay efectos aplicados en el ledger para este ciclo.</p> : (
          <div className="detail-values">
            <Value label="Secuencia">{historyNumber(lastEffect.sequence, 0)}</Value>
            <Value label="Operación">{historyText(lastEffect.operationType)}</Value>
            <Value label="Δ Créditos">{historyNumber(lastEffect.budgetDelta)}</Value>
            <Value label="Δ Energía">{historyNumber(lastEffect.energyDelta)}</Value>
            <Value label="Budget después">{historyNumber(lastEffect.budgetAfter)}</Value>
            <Value label="Energía después">{historyNumber(lastEffect.energyAfter)}</Value>
            <Value label="Aplicación">{historyDate(lastEffect.appliedAt)}</Value>
          </div>
        )}
      </Section>
    </>
  )
}

function CycleE2History({ cycleId }) {
  const [history, setHistory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    let timer
    let busy = false

    async function refresh() {
      if (!active || busy) return
      busy = true
      try {
        const result = await getCycleHistory(cycleId, { signal: controller.signal })
        if (!active) return
        if (!historyMatchesCycle(result, cycleId)) throw new Error('Ciclo incorrecto')
        setHistory(result)
        setError('')
        setUpdatedAt(new Date().toISOString())
      } catch (err) {
        if (active && err?.name !== 'AbortError') {
          setError('No se pudo actualizar el historial E2. Compruebe que E2-056 esté desplegado.')
        }
      } finally {
        busy = false
        if (active) {
          setLoading(false)
          timer = window.setTimeout(refresh, REFRESH_MS)
        }
      }
    }
    refresh()
    return () => {
      active = false
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [cycleId, refreshKey])

  return (
    <div className="cycle-e2-history" aria-label="Historial del mercado E2">
      <div className="cycle-e2-header">
        <div>
          <p className="eyebrow">EnergyShark E2 · RF01</p>
          <h2>Historial del mercado y liquidaciones</h2>
          <p className="cycle-e2-caption">Ofertas, bids, swaps, transporte, settlement y efectos registrados para este ciclo.</p>
          {updatedAt && <p className="cycle-e2-updated">Consulta actualizada: {historyDate(updatedAt)}</p>}
        </div>
        <button type="button" className="page-action-button" onClick={() => setRefreshKey((value) => value + 1)}>
          Actualizar historial
        </button>
      </div>
      {loading && <p role="status" className="market-book-message">Cargando historial E2...</p>}
      {error && <p role="alert" className="market-book-message market-book-error">{error}{history ? ' Se muestran los últimos datos recibidos.' : ''}</p>}
      {history && <HistoryContents history={history} />}
    </div>
  )
}

export default CycleE2History
