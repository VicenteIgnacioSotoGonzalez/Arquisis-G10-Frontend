import { useEffect, useState } from 'react'
import { getCycles, getMarketBook } from '../services/api'
import { feedFreshness, offerAvailability, routeDescription, sortMarketOffers } from '../services/marketBook'

const number = (value) => value == null ? '—' : new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(Number(value))
const penaltyRate = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
const date = (value) => value ? new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—'

function MarketBookView({ cycleIds, onBack }) {
  const [cycleId, setCycleId] = useState('')
  const [availableCycleIds, setAvailableCycleIds] = useState(cycleIds)
  const selectedCycleId = cycleId || availableCycleIds[0] || ''
  const [book, setBook] = useState(null)
  const [loading, setLoading] = useState(Boolean(selectedCycleId))
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [includeInactive, setIncludeInactive] = useState(true)
  const offers = sortMarketOffers(book?.offers ?? [])

  useEffect(() => {
    let active = true
    getCycles().then((data) => {
      if (!active) return
      const latest = (data.items ?? []).map((cycle) => cycle.cycleId)
      setAvailableCycleIds((current) => [...new Set([...current, ...latest])])
    }).catch(() => {})
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!selectedCycleId) return
    let active = true
    let timer
    async function refresh() {
      try {
        const value = await getMarketBook(selectedCycleId, { includeInactive })
        if (active) { setBook(value); setError(null) }
      } catch (err) {
        if (active) setError(err.message)
      } finally {
        if (active) {
          setLoading(false)
          timer = window.setTimeout(refresh, 10000)
        }
      }
    }
    refresh()
    return () => { active = false; window.clearTimeout(timer) }
  }, [selectedCycleId, includeInactive, reloadKey])

  function selectCycle(event) {
    setCycleId(event.target.value)
    setBook(null)
    setError(null)
    setLoading(true)
  }

  return <div className="market-book-view">
    <section className="page-header"><div>
      <p className="eyebrow">RF02 · Mercado y transporte</p>
      <div className="module-title-row"><h1>Libro de ofertas</h1><button className="module-back-button" type="button" onClick={onBack}>← Volver</button></div>
      <p className="page-description">Observaciones locales del feed. Los precios efectivos usan la última distance-table del ciclo y se actualizan cada 10 segundos.</p>
    </div></section>
    <section className="market-panel">
      {selectedCycleId ? <>
        <label>Ciclo <select value={selectedCycleId} onChange={selectCycle}>{availableCycleIds.map((id) => <option key={id} value={id}>{id}</option>)}</select></label>
        <label><input type="checkbox" checked={includeInactive} onChange={(event) => { setIncludeInactive(event.target.checked); setBook(null); setError(null); setLoading(true) }} /> Mostrar retiradas, cerradas e inciertas</label>
        <button className="page-action-button" type="button" onClick={() => { setLoading(true); setError(null); setReloadKey((value) => value + 1) }}>Actualizar ahora</button>
      </> : <p>No hay ciclos disponibles. El libro aparecerá cuando se registre un ciclo.</p>}
    </section>
    {(loading || (selectedCycleId && !book && !error)) && <section className="state-card"><div className="spinner" /><p>Cargando libro de mercado...</p></section>}
    {error && <section className="state-card error-card" role="alert"><h2>No fue posible actualizar el mercado</h2><p>{error}</p><p>Los precios y disponibilidades previos no se muestran como vigentes.</p></section>}
    {!loading && !error && book && <>
      <section className="market-panel">
        <h2>Frescura y cierre</h2>
        <p role="status">{feedFreshness(book)}</p>
        <p>Observado: {date(book.asOf)} · Último evento del feed: {date(book.lastFeedEventAt)} · Posible brecha: {date(book.feedGapAt)}</p>
        <p>Cierre programado: {date(book.closesAt)} · Tabla de distancias: {date(book.distanceTableTimestamp)}</p>
        {book.disabledRouteTransportCost != null && <p>Tarifa punitiva de ruta deshabilitada: {penaltyRate.format(Number(book.disabledRouteTransportCost))} CR/(KWH·km).</p>}
        <p className="market-warning">El feed no ofrece confirmación de disponibilidad ni recuperación completa de mensajes perdidos. Consulta la oferta y la ventana antes de actuar.</p>
      </section>
      <section className="market-panel"><h2>Ofertas observadas ({book.total})</h2>
        {offers.length === 0 ? <p>Sin ofertas registradas para este ciclo.</p> : <div className="table-wrapper"><table><thead><tr>
          <th>Oferta / ciudad</th><th>Cantidad inicial</th><th>Disponible observado</th><th>Estado</th><th>Ruta</th><th>Distancia</th><th>Precio nominal</th><th>Transporte</th><th>Precio efectivo</th><th>Último evento</th>
        </tr></thead><tbody>{offers.map((offer) => <tr key={`${offer.cityId}-${offer.offerId}`}>
          <td className="audit-identifier">{offer.offerId} · {offer.cityId}</td>
          <td>{offer.quantity == null ? '—' : `${number(offer.quantity)} KWH`}</td>
          <td>{offer.remaining == null ? '—' : `${number(offer.remaining)} KWH`}</td>
          <td>{offerAvailability(book, offer)}</td>
          <td>{routeDescription(offer)}</td>
          <td>{offer.distanceMeters == null ? '—' : `${number(offer.distanceMeters)} m`}</td>
          <td>{offer.pricePerEnergy == null ? '—' : `${number(offer.pricePerEnergy)} CR/KWH`}</td>
          <td>{offer.transportPerEnergy == null ? 'Sin tarifa verificable' : `${number(offer.transportPerEnergy)} CR/KWH`}</td>
          <td><strong>{offer.effectivePricePerEnergy == null ? 'No calculable' : `${number(offer.effectivePricePerEnergy)} CR/KWH`}</strong></td>
          <td>{date(offer.lastEventAt)}</td>
        </tr>)}</tbody></table></div>}
      </section>
    </>}
  </div>
}

export default MarketBookView
