import { useEffect, useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import {
  createNegotiation,
  getNegotiation,
  getCycles,
} from '../services/api'

import { negotiationIntent, clearNegotiationIntent } from '../services/negotiationIntent'

function NegotiationForm({ onBack }) {
  const { loginWithRedirect } = useAuth0()

  const [cycleId, setCycleId] = useState('')
  const [availableCycles, setAvailableCycles] = useState([])
  const [direction, setDirection] =
    useState('give')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')

  const [loadingCycles, setLoadingCycles] =
    useState(true)
  const [submitting, setSubmitting] =
    useState(false)
  const [formError, setFormError] = useState(null)
  const [needsLogin, setNeedsLogin] =
    useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    let active = true

    let timer
    async function refresh() {
      try {
        const data = await getCycles()
        if (!active) return
        const openCycles = (data.items ?? []).filter((item) => item.negotiationOpen)
        setAvailableCycles(openCycles)
        setCycleId((selected) => openCycles.some((item) => item.cycleId === selected)
          ? selected : (openCycles[0]?.cycleId ?? ''))
      } catch {
        // Conservar la selección; la API vuelve a validar la ventana al enviar.
      } finally {
        if (active) {
          setLoadingCycles(false)
          timer = window.setTimeout(refresh, 5000)
        }
      }
    }
    refresh()
    return () => { active = false; window.clearTimeout(timer) }
  }, [])

  const negotiationId = result?.id
  useEffect(() => {
    if (!negotiationId) return
    let active = true
    let timer
    async function refresh() {
      try {
        const data = await getNegotiation(negotiationId)
        if (active) setResult(data)
      } catch {
        // Conservar la última respuesta; la siguiente consulta puede recuperarse.
      } finally {
        if (active) timer = window.setTimeout(refresh, 5000)
      }
    }
    timer = window.setTimeout(refresh, 5000)
    return () => { active = false; window.clearTimeout(timer) }
  }, [negotiationId])

  function validate() {
    if (!cycleId) {
      return 'No hay ciclos disponibles para crear una propuesta.'
    }

    if (!quantity || !Number.isFinite(Number(quantity)) || Number(quantity) <= 0) {
      return 'La cantidad debe ser mayor a 0.'
    }

    if (price === '' || !Number.isFinite(Number(price)) || Number(price) < 0) {
      return 'El precio no puede ser negativo.'
    }

    return null
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError(null)
    setNeedsLogin(false)
    setResult(null)

    const validationError = validate()

    if (validationError) {
      setFormError(validationError)
      return
    }

    setSubmitting(true)

    try {
      const data = await createNegotiation(negotiationIntent({
        cycleId,
        direction,
        requestedQuantity: quantity,
        offeredPrice: price,
      }, window.sessionStorage))
      clearNegotiationIntent(window.sessionStorage)

      setResult(data)
    } catch (err) {
      if (err.message.includes('status 401')) {
        setNeedsLogin(true)
        setFormError(
          'Inicia sesión para crear negociaciones.',
        )
      } else if (err.message.includes('status 404')) {
        setFormError(
          'El ciclo seleccionado ya no existe.',
        )
      } else if (err.message.includes('status 422')) {
        setFormError(
          'Revisa que los datos son correctos o si la ventana de negociación sigue abierta.',
        )
      } else {
        setFormError(err.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <section className="page-header">
        <div>
          <p className="eyebrow">
            Negociación voluntaria
          </p>

          <div className="module-title-row">
            <h1>Nueva propuesta</h1>
            <button
              className="module-back-button"
              type="button"
              onClick={onBack}
            >
              ← Volver
            </button>
          </div>

          <p className="page-description">
            {cycleId
              ? `La propuesta se asociará al ciclo abierto: ${cycleId}.`
              : 'No hay ciclos disponibles para crear una propuesta.'}
          </p>
        </div>
      </section>

      <section className="negotiation-form-card">
        <form
          className="negotiation-form"
          onSubmit={handleSubmit}
        >
          <label className="negotiation-field">
            Ciclo abierto por la central
            <select value={cycleId} onChange={(event) => setCycleId(event.target.value)} disabled={submitting}>
              {!availableCycles.length && <option value="">Sin ciclos abiertos</option>}
              {availableCycles.map((cycle) => <option key={cycle.cycleId} value={cycle.cycleId}>{cycle.cycleId}</option>)}
            </select>
          </label>
          <label className="negotiation-field">
            Dirección
            <select
              value={direction}
              onChange={(event) =>
                setDirection(event.target.value)
              }
              disabled={submitting}
            >
              <option value="give">
                Entregar (give)
              </option>

              <option value="take">
                Recibir (take)
              </option>
            </select>
          </label>

          <label className="negotiation-field">
            Cantidad (kWh)
            <input
              type="number"
              min="0"
              step="0.01"
              value={quantity}
              onChange={(event) =>
                setQuantity(event.target.value)
              }
              disabled={submitting}
            />
          </label>

          <label className="negotiation-field">
            Techo de oferta (créditos/kWh)
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(event) =>
                setPrice(event.target.value)
              }
              disabled={submitting}
            />
          </label>

          <div className="negotiation-form-actions">
            <button
              className="negotiation-submit-button"
              type="submit"
              disabled={
                submitting || loadingCycles || !cycleId
              }
            >
              {submitting
                ? 'Enviando...'
                : 'Crear propuesta'}
            </button>

          </div>
        </form>
      </section>

      {formError && (
        <section className="state-card error-card">
          <h2>No se pudo crear la propuesta</h2>

          <p>{formError}</p>

          {needsLogin && (
            <button
              type="button"
              onClick={() => loginWithRedirect()}
            >
              Iniciar sesión
            </button>
          )}
        </section>
      )}

      {result && (
        <section className="state-card">
          <h2>Propuesta creada</h2>

          <p>
            ID {result.id} · Estado{' '}
            {result.status === 'ACKNOWLEDGED' ? 'Recibida (ACK), pendiente de confirmación' : result.status}
          </p>
          {result.confirmedEnergy != null && <p>Energía confirmada: {result.confirmedEnergy} kWh · Precio: {result.confirmedPrice} créditos/kWh</p>}
          <p>Pago: {result.paymentQuantity == null ? 'Pendiente' : `${result.paymentQuantity} créditos`}</p>
        </section>
      )}
    </div>
  )
}

export default NegotiationForm
