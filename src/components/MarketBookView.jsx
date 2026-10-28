import { useEffect, useMemo, useState } from 'react'
import { getCycles, getMarketBook } from '../services/api'
import { displayDate, displayNumber, offerStatus, routeLabel, sortMarketOffers } from '../services/marketBook'

const REFRESH_MILLISECONDS = 10_000

function MarketBookView({ onBack }) {
  const [cycles, setCycles] = useState([])
  const [cycleId, setCycleId] = useState('')
  const [cycleError, setCycleError] = useState('')
  const [loadingCycles, setLoadingCycles] = useState(true)
  const [includeInactive, setIncludeInactive] = useState(false)
  const [book, setBook] = useState(null)
  const [bookError, setBookError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let active = true
    getCycles()
      .then((data) => {
        if (!active) return
        const items = Array.isArray(data?.items) ? data.items : []
        setCycles(items)
        setCycleId((previous) => previous || String(items[0]?.cycleId ?? ''))
      })
      .catch(() => {
        if (active) setCycleError('No se pudo cargar la lista de ciclos.')
      })
      .finally(() => {
        if (active) setLoadingCycles(false)
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!cycleId) return undefined
    let active = true
    let busy = false
    const controller = new AbortController()
    // El dato de otro ciclo nunca debe mostrarse bajo la nueva selección.
    const update = async () => {
      if (!active || busy) return
      busy = true
      try {
        const result = await getMarketBook(cycleId, { includeInactive, signal: controller.signal })
        if (!active) return
        setBook(result)
        setBookError('')
      } catch (error) {
        if (active && error.name !== 'AbortError') {
          setBookError('No fue posible actualizar el libro. Si hay datos visibles, pueden estar desactualizados.')
        }
      } finally {
        busy = false
      }
    }
    update()
    const interval = window.setInterval(update, REFRESH_MILLISECONDS)
    return () => {
      active = false
      controller.abort()
      window.clearInterval(interval)
    }
  // refreshKey permite solicitar una nueva lectura manual.
  }, [cycleId, includeInactive, refreshKey])

  const offers = useMemo(() => sortMarketOffers(book?.offers ?? []), [book])

  const changeCycle = (value) => {
    setBook(null)
    setBookError('')
    setCycleId(value)
  }

  const changeInactive = (value) => {
    setBook(null)
    setBookError('')
    setIncludeInactive(value)
  }

  return (
    <div className="market-book-page">
      <button type="button" className="module-back-button" onClick={onBack}>
        ← Volver al historial de ciclos
      </button>

      <section className="page-header market-book-heading">
        <div>
          <p className="eyebrow">Mercado E2 · RF02</p>
          <h1>Libro de ofertas en vivo</h1>
          <p className="page-description">
            Precios y cantidades del feed de mercado, con el transporte calculado para King's Landing.
            Actualización automática cada 10 segundos.
          </p>
        </div>
      </section>

      <section className="market-book-controls" aria-label="Filtros del mercado">
        <div className="market-book-cycle-control">
          <label htmlFor="market-cycle">Ciclo de negociación</label>
          <select
            id="market-cycle"
            value={cycleId}
            onChange={(event) => changeCycle(event.target.value)}
            disabled={loadingCycles || cycles.length === 0}
          >
            {cycles.length === 0 && <option value="">Sin ciclos disponibles</option>}
            {cycles.map((cycle) => (
              <option key={cycle.cycleId} value={cycle.cycleId}>{cycle.cycleId}</option>
            ))}
          </select>
        </div>
        <label className="market-book-toggle">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(event) => changeInactive(event.target.checked)}
          />
          Mostrar retiradas, cerradas e inciertas
        </label>
        <button
          type="button"
          className="page-action-button"
          disabled={!cycleId}
          onClick={() => setRefreshKey((value) => value + 1)}
        >
          Actualizar ahora
        </button>
      </section>

      {loadingCycles && <p role="status" className="market-book-message">Cargando ciclos...</p>}
      {cycleError && <p role="alert" className="market-book-message market-book-error">{cycleError}</p>}
      {!loadingCycles && !cycleError && cycles.length === 0 && (
        <p className="market-book-message">No hay ciclos registrados para consultar.</p>
      )}
      {!book && cycleId && !bookError && <p role="status" className="market-book-message">Consultando ofertas...</p>}
      {bookError && <p role="alert" className="market-book-message market-book-error">{bookError}</p>}

      {book && (
        <>
          <div className="market-book-meta" aria-live="polite">
            <span className={book.marketClosed ? 'market-book-chip market-book-chip-closed' : 'market-book-chip market-book-chip-open'}>
              {book.marketClosed ? 'Mercado cerrado' : 'Mercado sin cierre registrado'}
            </span>
            <span>Ofertas: <strong>{book.total ?? offers.length}</strong></span>
            <span>Consulta: <strong>{displayDate(book.asOf)}</strong></span>
            <span>Cierre programado: <strong>{displayDate(book.closesAt)}</strong></span>
          </div>
          {book.distanceTableTimestamp == null && (
            <p className="market-book-message">Sin tabla de distancias para este ciclo. El precio efectivo podría no estar disponible.</p>
          )}
          <section className="cycles-card market-book-table-card" aria-label="Ofertas del mercado">
            {offers.length === 0 ? (
              <div className="market-book-empty">
                <h2>Sin ofertas para este filtro</h2>
                <p>La central todavía no informa ofertas visibles, o el mercado está cerrado.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="market-book-table">
                  <thead>
                    <tr>
                      <th>Ciudad / oferta</th>
                      <th>Estado</th>
                      <th>Cantidad (kWh)</th>
                      <th>Restante (kWh)</th>
                      <th>Precio nominal (CR/kWh)</th>
                      <th>Distancia (m)</th>
                      <th>Transporte (CR/kWh)</th>
                      <th>Precio efectivo (CR/kWh)</th>
                      <th>Ruta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offers.map((offer) => (
                      <tr key={`${offer.cityId}:${offer.offerId}`}>
                        <td>
                          <strong>{offer.cityId}</strong>
                          <span className="market-book-offer-id" title={offer.offerId}>{offer.offerId}</span>
                        </td>
                        <td>
                          <span className={offer.uncertain || offer.stale ? 'market-book-uncertain' : ''}>
                            {offerStatus(offer)}
                          </span>
                        </td>
                        <td>{displayNumber(offer.quantity, 0)}</td>
                        <td>{displayNumber(offer.remaining, 0)}</td>
                        <td>{displayNumber(offer.pricePerEnergy)}</td>
                        <td>{displayNumber(offer.distanceMeters, 0)}</td>
                        <td>{displayNumber(offer.transportPerEnergy)}</td>
                        <td className="market-book-effective">{displayNumber(offer.effectivePricePerEnergy)}</td>
                        <td>
                          <span className={offer.routeEnabled === false ? 'market-book-route-disabled' : ''}>
                            {routeLabel(offer.routeEnabled)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <p className="market-book-footnote">
            Los precios efectivos y las tarifas de rutas deshabilitadas provienen del backend.
            Una ruta deshabilitada puede seguir disponible con tarifa punitiva.
            La información del feed puede estar desactualizada respecto de la central.
          </p>
        </>
      )}
    </div>
  )
}

export default MarketBookView
