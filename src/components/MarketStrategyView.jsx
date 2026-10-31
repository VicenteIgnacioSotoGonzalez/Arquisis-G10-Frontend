import { useEffect, useState } from 'react'
import { getStrategy, getStrategyOptions, updateStrategy } from '../services/api'
import { strategyFormFrom, strategyPayload, validateStrategyForm } from '../services/marketStrategy'
import MarketActivityView from './MarketActivityView'

const selectionPolicyLabels = {
  CHEAPEST_EFFECTIVE_PRICE: 'Menor precio efectivo',
  MIN_DISTANCE: 'Menor distancia',
}

function MarketStrategyView({ cycleId, onBack }) {
  const [strategy, setStrategy] = useState(null)
  const [options, setOptions] = useState(null)
  const [form, setForm] = useState(strategyFormFrom())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    let active = true
    Promise.all([getStrategy(cycleId), getStrategyOptions()])
      .then(([value, allowed]) => {
        if (!active) return
        setStrategy(value)
        setOptions(allowed)
        setForm(strategyFormFrom(value.pending ?? value.active))
      })
      .catch((err) => { if (active) setError(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [cycleId])

  async function submit(event) {
    event.preventDefault()
    setNotice(null)
    const validation = validateStrategyForm(form, options)
    if (validation) { setError(validation); return }
    setSaving(true)
    setError(null)
    try {
      const saved = await updateStrategy(strategyPayload(form, strategy.pending?.version ?? strategy.active?.version))
      const refreshed = await getStrategy(cycleId)
      setStrategy(refreshed)
      setForm(strategyFormFrom(saved))
      setNotice(`Versión ${saved.version} guardada. Se aplicará al próximo ciclo que abra después de esta edición, sin reiniciar el nodo.`)
    } catch (err) {
      setError(err.message)
      if (err.status === 409) {
        const refreshed = await getStrategy(cycleId).catch(() => null)
        if (refreshed) { setStrategy(refreshed); setForm(strategyFormFrom(refreshed.pending ?? refreshed.active)) }
      }
    } finally { setSaving(false) }
  }

  function change(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  return <div className="market-admin">
    <section className="page-header"><div>
      <p className="eyebrow">RF04 · Estrategia comercial</p>
      <div className="module-title-row"><h1>Administrar mercado</h1><button className="module-back-button" onClick={onBack} type="button">← Volver</button></div>
      <p className="page-description">Los cambios se guardan sin redeploy. La estrategia del ciclo abierto permanece fija; la nueva versión entra en vigor al abrir el siguiente ciclo.</p>
    </div></section>
    {loading && <section className="state-card"><p>Cargando estrategia...</p></section>}
    {error && <p className="market-feedback error-card" role="alert">{error}</p>}
    {notice && <p className="market-feedback" role="status">{notice}</p>}
    {!loading && options && <>
      <div className="market-summary">
        <p><strong>Activa:</strong> {strategy?.active ? `v${strategy.active.version}` : 'Sin versión activa'}</p>
        <p><strong>Pendiente:</strong> {strategy?.pending ? `v${strategy.pending.version}, próximo ciclo` : 'Ninguna'}</p>
        <p><strong>Ciclo {cycleId ?? 'actual'}:</strong> {strategy?.cycleStrategy ? `v${strategy.cycleStrategy.version} · span ${strategy.cycleStrategy.spanSeconds} s` : 'Sin estrategia de ciclo consultable'}</p>
      </div>
      <form className="market-form" onSubmit={submit} noValidate>
        <label>Multiplicador del precio de oferta <small>Precio = costo de generación × multiplicador.</small><input name="offerPriceMarkup" type="number" min="0.0001" step="0.0001" value={form.offerPriceMarkup} onChange={change} required /></label>
        <label>Fracción de energía ofertada <small>0 a 1 del excedente vendible.</small><input name="offerQuantityFraction" type="number" min="0" max="1" step="0.0001" value={form.offerQuantityFraction} onChange={change} required /></label>
        <label>Precio directo (CR/KWH) <small>Opcional. Precio final elegido para la oferta; usa centavos.</small><input name="offerPriceOverride" type="number" min="0.01" step="0.01" value={form.offerPriceOverride} onChange={change} placeholder="Usar multiplicador" /></label>
        <label>Cantidad máxima (KWH) <small>Opcional. Nunca supera el excedente ni el saldo disponible en Wallet.</small><input name="offerQuantityCap" type="number" min="0" step="1" value={form.offerQuantityCap} onChange={change} placeholder="Sin tope adicional" /></label>
        <label>Espera de compra, span (segundos)<input name="spanSeconds" type="number" min="0" step="1" value={form.spanSeconds} onChange={change} required /></label>
        <label>Política de aceptación de bids<select name="bidAcceptancePolicy" value={form.bidAcceptancePolicy} onChange={change}>{options.bidAcceptancePolicies.map((policy) => <option key={policy} value={policy}>{policy}</option>)}</select></label>
        <label>Política de selección de ofertas<select name="offerSelectionPolicy" value={form.offerSelectionPolicy} onChange={change}>{options.offerSelectionPolicies.map((policy) => <option key={policy} value={policy}>{selectionPolicyLabels[policy] ?? policy}</option>)}</select></label>
        <button className="page-action-button" disabled={saving} type="submit">{saving ? 'Guardando...' : 'Guardar para el próximo ciclo'}</button>
      </form>
      <MarketActivityView cycleId={cycleId} />
    </>}
  </div>
}

export default MarketStrategyView
