import { useEffect, useState } from 'react'
import { getCycleHistory, getIntercityAudit } from '../services/api'
import { ackStage, bidStage, swapStage } from '../services/marketActivity'

function MarketActivityView({ cycleId }) {
  const [history, setHistory] = useState(null)
  const [intercity, setIntercity] = useState([])
  const [loading, setLoading] = useState(Boolean(cycleId))
  const [error, setError] = useState(null)
  const [auditError, setAuditError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!cycleId) return
    let active = true
    Promise.allSettled([getCycleHistory(cycleId), getIntercityAudit(cycleId)])
      .then(([cycle, audit]) => {
        if (!active) return
        if (cycle.status === 'fulfilled') setHistory(cycle.value)
        else setError(cycle.reason.message)
        if (audit.status === 'fulfilled') setIntercity((audit.value.items ?? []).filter((item) => item.type === 'ack' || item.type === 'nack'))
        else setAuditError(audit.reason.message)
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [cycleId, reloadKey])

  return <section className="market-panel" aria-label="Actividad de mercado del ciclo">
    <h2>Actividad de mercado · {cycleId ?? 'sin ciclo'}</h2>
    <p>ACK confirma recepción del mensaje; HTTP 202 confirma recepción de la solicitud por Wallet; sólo swap-settled confirma liquidación.</p>
    {cycleId && <button type="button" className="page-action-button" onClick={() => { setLoading(true); setError(null); setAuditError(null); setReloadKey((value) => value + 1) }}>Actualizar actividad</button>}
    {!cycleId && <p>Selecciona un ciclo para ver su actividad.</p>}
    {loading && <p role="status">Cargando historial de mercado...</p>}
    {error && <p className="market-feedback error-card" role="alert">{error}</p>}
    {!loading && history && <>
      <h3>Ofertas y bids</h3>
      <p>{history.offers?.length ?? 0} ofertas · {history.bids?.length ?? 0} bids</p>
      {(history.bids ?? []).length > 0 && <ul className="market-activity-list">{history.bids.map((bid) =>
        <li key={bid.idpk}><strong>{bid.direction} · {bid.offerId}</strong> · {bid.quantity} KWH · {bidStage(bid)} · idpk {bid.idpk}</li>)}</ul>}
      <h3>Swaps</h3>
      {(history.swaps ?? []).length === 0 ? <p>Sin swaps registrados.</p> : <ul className="market-activity-list">{history.swaps.map((swap) =>
        <li key={swap.idpk}><strong>{swap.swapId ?? swap.idpk}</strong> · {swap.role} · {swap.counterpartCityId} · {swapStage(swap)}{swap.rejectionReason ? ` · ${swap.rejectionReason}` : ''}</li>)}</ul>}
    </>}
    {cycleId && <>
      <h3>ACK/NACK interciudad</h3>
      {auditError && <p className="market-feedback error-card" role="alert">{auditError}</p>}
      {!auditError && !loading && (intercity.length === 0 ? <p>Sin ACK/NACK registrados en la página reciente de este ciclo.</p> :
        <ul className="market-activity-list">{intercity.map((message) => <li key={`${message.direction}-${message.msgId}`}>
          <strong>{ackStage(message)}</strong> · {message.direction} · objetivo {message.targetMsgId ?? 'sin referencia'} · {message.status}
        </li>)}</ul>)}
    </>}
  </section>
}

export default MarketActivityView
