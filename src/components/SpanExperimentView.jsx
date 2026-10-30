import { useEffect, useState } from 'react'
import { getCycleMetrics, getCycleReconciliation } from '../services/api'
import { summarizeBySpan } from '../services/spanExperiment'

const number = (value) => value == null ? '—' : new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(Number(value))

function SpanExperimentView({ onBack }) {
  const [metrics, setMetrics] = useState([])
  const [wallet, setWallet] = useState({})
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    getCycleMetrics(offset, 50).then(async (page) => {
      const values = page.items ?? []
      const checks = await Promise.allSettled(values.map((metric) => getCycleReconciliation(metric.cycleId)))
      if (!active) return
      setMetrics(values)
      setTotal(page.total ?? 0)
      setWallet(Object.fromEntries(values.map((metric, index) => [metric.cycleId,
        checks[index].status === 'fulfilled' ? checks[index].value.items?.[0] ?? null : null])))
      setError(null)
    }).catch((err) => { if (active) setError(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [offset])

  const groups = summarizeBySpan(metrics)
  return <div className="span-experiment">
    <section className="page-header"><div><p className="eyebrow">RF06 · Experimento de span</p>
      <div className="module-title-row"><h1>Comparación por tiempo de espera</h1><button className="module-back-button" type="button" onClick={onBack}>← Volver</button></div>
      <p className="page-description">Métricas del ciclo con el span efectivamente aplicado. El agregado usa sólo ciclos finales con baseline y costo real; los ciclos pendientes permanecen visibles abajo.</p>
    </div></section>
    {loading && <section className="state-card"><p>Cargando métricas...</p></section>}
    {error && <p className="market-feedback error-card" role="alert">{error}</p>}
    {!loading && !error && <>
      <section className="market-panel"><h2>Resultados agrupados por span</h2>
        <p>Agregado de esta página ({offset + 1}–{Math.min(offset + 50, total)} de {total} ciclos). Los montos provienen del ledger de hechos Wallet confirmados; la conciliación se muestra por separado.</p>
        {groups.length === 0 ? <p>Sin ciclos con métricas todavía.</p> : <div className="table-wrapper"><table><thead><tr><th>Span</th><th>Ciclos finales / vistos</th><th>Déficit cubierto</th><th>Bids rechazados</th><th>Baseline</th><th>Costo real</th><th>Ahorro</th></tr></thead><tbody>{groups.map((group) => <tr key={group.spanSeconds}><td>{group.spanSeconds} s</td><td>{group.finalCycles} / {group.cycles}</td><td>{group.deficitKwh ? `${number(group.coveredKwh)} / ${number(group.deficitKwh)} KWH` : '—'}</td><td>{group.finalCycles ? group.rejectedBids : '—'}</td><td>{group.finalCycles ? number(group.baselineCost) : '—'}</td><td>{group.finalCycles ? number(group.realCost) : '—'}</td><td>{group.finalCycles ? number(group.savingsVsBaseline) : '—'}</td></tr>)}</tbody></table></div>}
      </section>
      <section className="market-panel"><h2>Detalle por ciclo</h2><div className="table-wrapper"><table><thead><tr><th>Ciclo</th><th>Span / política</th><th>Estado</th><th>Cobertura</th><th>Bids rechazados</th><th>Baseline</th><th>Costo real</th><th>Ahorro</th><th>Wallet</th></tr></thead><tbody>{metrics.map((metric) => <tr key={metric.cycleId}><td>{metric.cycleId}</td><td>{metric.spanSeconds} s · {metric.selectionPolicy}</td><td>{metric.status}</td><td>{number(metric.coveredKwh)} / {number(metric.deficitKwh)} KWH</td><td>{metric.rejectedBids}</td><td>{number(metric.baselineCost)} ({metric.baselineSource ?? 'sin fuente'})</td><td>{number(metric.realCost)}</td><td>{number(metric.savingsVsBaseline)}</td><td>{wallet[metric.cycleId] ? `${wallet[metric.cycleId].status} · ${number(wallet[metric.cycleId].cr?.wallet)} CR / ${number(wallet[metric.cycleId].kwh?.wallet)} KWH` : 'Sin conciliación disponible'}</td></tr>)}</tbody></table></div></section>
      <div className="market-pagination"><button disabled={offset === 0} onClick={() => { setLoading(true); setOffset(Math.max(0, offset - 50)) }}>Anterior</button><span>{total ? `${offset + 1}–${Math.min(offset + 50, total)} de ${total}` : '0 ciclos'}</span><button disabled={offset + 50 >= total} onClick={() => { setLoading(true); setOffset(offset + 50) }}>Siguiente</button></div>
    </>}
  </div>
}

export default SpanExperimentView
